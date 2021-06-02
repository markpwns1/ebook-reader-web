const EBOOK_CONTAINER_PATH = "META-INF/container.xml";

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

            zip.file(EBOOK_CONTAINER_PATH).async("text").then(txt => {

                const contentFile = $($.parseXML(txt)).find("rootfile").attr("full-path");

                zip.file(contentFile).async("text").then(txt => {

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
        if(path.startsWith("./"))
            path = path.substring(2);

        const found = this.content.find(x => x.href == path);
        if(!found) throw generateFileNotFoundError(path);
        return found;
    }

    getContentFile(path) {
        if(path.startsWith("./"))
            path = path.substring(2);
        
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

    openFile(path, type, onsuccess, onerror) {
        if(path.startsWith("./"))
            path = path.substring(2);

        if(!this.content.find(x => x.href == path)) {
            onerror(generateFileNotFoundError(path));
            return;
        }

        this.zip.file(path).async(type).then(onsuccess).catch(onerror);
    }

    openContent(path, type, onsuccess, onerror) {
        if(path.startsWith("./"))
            path = path.substring(2);

        this.openFile(this.contentRoot + path, type, onsuccess, onerror);
    }

    generateFileNotFoundError(path) {
        return new Error(`File "${path}" not found in book "${this.title}"`);
    }

    getSpineIndex(file) {
        return this.spine.indexOf(this.spine.find(x => x == file.id));
    }

}