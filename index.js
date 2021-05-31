
const book = { 
    zip: null,
    content: [ ],
    spine: [ ]
}

let $content;
let currentPage = 0;
let loaded = [ ];
let loading = false;

const loadPage = (index, callback) => {

    if(loading) return;
    if(index < currentPage) return;
    if(index >= book.spine.length) return;
    
    currentPage = index;
    loading = true;

    const content = book.content.find(x => x.id == book.spine[index]);

    book.zip.file(content.href).async("text").then(txt => {
        loaded.push(content.href);
        const page = $(txt);

        for(const img of page.find("img")) {
            const imgSrc = img.getAttribute("src");
            book.zip.file(imgSrc).async("blob").then(blob => {
                img.src = URL.createObjectURL(blob);
            });
            img.classList.add("centered-image");
        }

        for (const img of page.find("image")) {
            const $newImage = $(img);
            book.zip.file($newImage.attr("xlink:href")).async("blob").then(blob => {
                $newImage.attr("xlink:href", URL.createObjectURL(blob));
            });
        }

        for (const a of page.find("a")) {
            const $a = $(a);
            const link = $a.attr("href");
            $a.removeAttr("href");
            $a.click(() => {
                // console.log(link.substring(0, link.indexOf("#")));
                // console.log(book.spine);
                const foundContent = book.content.find(x => x.href == link.substring(0, link.indexOf("#")));
                const foundSpineEntry = book.spine.find(x => x == foundContent.id);
                const index = book.spine.indexOf(foundSpineEntry);

                const onReady = () => {
                    // if(!link.includes("#"))
                    const url = location.href;
                    location.href = link.substring(link.indexOf("#"));
                    history.replaceState(null, null, url);   
                }

                const loadLoop = () => {
                    if(currentPage < index)
                        loadPage(currentPage + 1, loadLoop);
                    else 
                        onReady();
                }

                if(index <= currentPage) {
                    onReady();
                }
                else {
                    loadLoop();
                }
                // console.log(loaded);
            });
        }

        $content.append(page);
        loading = false;

        if(callback) callback();
        // loadPage(index + 1);
    });
}

window.onload = () => {

    $content = $("#result");

    

    $("#btn-load-more").click(() => {
        loadPage(currentPage + 1);
    });

    window.onscroll = function(ev) {
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight) {
            loadPage(currentPage + 1);
        }
    };

    $("#file").on("change", function(evt) {
        // remove content
        $content.html("");

        // Closure to capture the file information.
        function handleFile(f) {

            JSZip.loadAsync(f)
            .then(function(zip) {
                book.zip = zip;

                zip.file("content.opf").async("text").then(txt => {
                    // console.log(txt)
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(txt, "application/xhtml+xml");
                    const items = doc.getElementsByTagName("item");
                    for (const item of items) {
                        book.content.push({
                            href: item.getAttribute("href"),
                            id: item.getAttribute("id"),
                            mediaType: item.getAttribute("media-type")
                        });
                    }
                    const spineItems = doc.getElementsByTagName("itemref");
                    for (const spineItem of spineItems) {
                        book.spine.push(spineItem.getAttribute("idref"));
                    }

                    for (const c of book.content) {
                        // if(c.mediaType.startsWith("image")) {
                        //     zip.file(c.href).async("image").then(x => {
                        //         console.log(x);
                        //     });
                        // }
                    }

                    // let i = 0;
                    
                    loadPage(0);
                    
                    // console.log(book)

                    // for (const navPoint of navPoints) {
                    //     // navPoint.childNodes["content"]
                    //     // navPoint.attr
                    //     console.log(navPoint.getElementsByTagName("content")[0].getAttribute("src"))
                    // }
                    // console.log(navPoints.length)
                });
            }, function (e) {
                console.log("Error reading " + f.name + ": " + e.message);
            });
        }

        var files = evt.target.files;
        for (var i = 0; i < files.length; i++) {
            handleFile(files[i]);
        }
    });
}

