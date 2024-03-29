const EBOOK_CONTAINER_PATH = "META-INF/container.xml";

const appendPath = (a, b) => {
    if(a.startsWith("./")) a = a.slice(2);
    else if(a.startsWith("/")) a = a.slice(1);
    if(b.startsWith("./")) b = b.slice(2);

    if(a.endsWith("/") && b.startsWith("/")) return a + b.slice(1);
    else if(a != "" && b != "" && !a.endsWith("/") && !b.endsWith("/")) return a + "/" + b;
    else return a + b;
};

const getDirFromPath = x => x.includes("/")? x.slice(0, x.lastIndexOf("/")) : "";

/**
 * 
 * @param {string} path 
 */
function fixPath(path) {

    let i = 0;
    while (i < path.length - 2) {
        const sl = path.slice(i, i + 3);
        if (sl == "/..") {
            let j = i;
            path = path.slice(0, i) + path.slice(Math.min(path.length, i + 3))
            do {
                i--;
            } while (path[i] != "/" && i > 0);
            path = path.slice(0, i) + path.slice(Math.min(path.length, j))
        }
        else {
            i++;
        }
    }

    if(path.startsWith("./")) path = path.slice(2);
    else if(path.startsWith("/")) path = path.slice(1);

    return path;
}

class Book {

    zip = null;

    title;
    creator;
    genres = [ ];
    description;

    contentRoot = "";
    content = [ ];
    spine = [ ];
    tableOfContents = [ ];

    ncxPath;

    static open(file, onsuccess, onerror) {
        const b = new Book();
        b._init(file, () => {
            onsuccess(b);
        },
        e => {
            if(onerror) onerror(e);
        });
    }

    _init(file, onsuccess, onerror) {
        JSZip.loadAsync(file).then(zip => {
            this.zip = zip;

            const ebookContainerFile = zip.file(EBOOK_CONTAINER_PATH);
            if(!ebookContainerFile) {
                onerror(new Error("E-Book is missing the file: " + EBOOK_CONTAINER_PATH));
                return;
            }

            ebookContainerFile.async("text").then(txt => {

                const contentFile = $($.parseXML(txt)).find("rootfile").attr("full-path");
                const foundFile = zip.file(contentFile);

                if(!foundFile) {
                    onerror(new Error("Content file was not found at: " + contentFile));
                    return;
                }

                foundFile.async("text").then(txt => {

                    if(contentFile.includes("/"))
                        this.contentRoot = contentFile.substring(0, contentFile.lastIndexOf("/") + 1)
                    
                    const doc = new DOMParser().parseFromString(txt, "application/xhtml+xml");

                    const tryGet = (tagName, onsuccess, onerror) => {
                        const found = doc.getElementsByTagName(tagName);
                        if(found.length > 0) onsuccess(found);
                        else if(onerror) onerror(new Error("Tag does not exist: " + tagName));
                    }

                    const items = doc.getElementsByTagName("item");

                    for (const item of items) {
                        this.content.push({
                            href: this.contentRoot + item.getAttribute("href"),
                            id: item.getAttribute("id"),
                            mediaType: item.getAttribute("media-type")
                        });
                    }

                    const spineItems = doc.getElementsByTagName("itemref");
                    for (const spineItem of spineItems) {
                        this.spine.push(spineItem.getAttribute("idref"));
                    }

                    tryGet("dc:title", x => {
                        this.title = x[0].textContent;
                    });

                    tryGet("dc:creator", x => {
                        this.creator = x[0].textContent;
                    });

                    tryGet("dc:subject", x => {
                        for (const y of x) {
                            this.genres.push(y.textContent);
                        };
                    });

                    tryGet("dc:description", x => {
                        this.description = x[0].textContent;
                    });
                    
                    const ncxFile = this.content.find(x => x.id == "ncx" && x.mediaType == "application/x-dtbncx+xml");
                    if(ncxFile) {

                        this.openFile(ncxFile.href, "text", txt => {
                            this.ncxPath = ncxFile.href;

                            const $xml = $($.parseXML(txt));

                            let navPoints = $xml.find("navPoint");
                            navPoints = navPoints.sort((a, b) => a.playOrder - b.playOrder);

                            for (const navPoint of navPoints) {
                                this.tableOfContents.push({
                                    label: $(navPoint).find("text").text(),
                                    link: $(navPoint).find("content").attr("src")
                                });
                            }
            
                            onsuccess();

                        }, onerror);

                    }
                    else onsuccess();

                }).catch(onerror);

            }).catch(onerror);

        }).catch(onerror);
    }

    getFile(path) {
        path = fixPath(path);

        const found = this.content.find(x => x.href == path);
        if(!found) throw this.generateFileNotFoundError(path);
        return found;
    }

    getContentFile(path) {
        path = fixPath(path);
        
        return this.getFile(this.contentRoot + path);
    }

    getFileByID(id) {
        const found = this.content.find(x => x.id == id);
        if(!found) throw new Error(`File with ID "${id}" not found in book "${this.title}"`);
        return found;
    }

    getFileBySpineIndex(index) {
        if(index < 0 || index >= this.spine.length) 
            throw Error("Index out of bounds: " + index);

        return this.getFileByID(this.spine[index]);
    }

    getPageCount() {
        return this.spine.length;
    }

    openFile(path, type, onsuccess, onerror) {
        path = fixPath(path);

        if(!this.content.find(x => x.href == path)) {
            if(onerror) onerror(this.generateFileNotFoundError(path));
            else console.log(this.generateFileNotFoundError(path));
            return;
        }

        const f = this.zip.file(path);
        
        if(!f) {
            if(onerror) onerror(this.generateFileNotFoundError(path));
            else console.log(this.generateFileNotFoundError(path));
            return;
        }

        f.async(type).then(onsuccess).catch(onerror);
    }

    openContent(path, type, onsuccess, onerror) {
        path = fixPath(path);

        this.openFile(this.contentRoot + path, type, onsuccess, onerror);
    }

    generateFileNotFoundError(path) {
        return new Error(`File "${path}" not found in book "${this.title}"`);
    }

    getSpineIndex(file) {
        return this.spine.indexOf(this.spine.find(x => x == file.id));
    }

}