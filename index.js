
const book = { 
    zip: null,
    content: [ ],
    spine: [ ]
}

window.onload = () => {
    var $result = $("#result");
    $("#file").on("change", function(evt) {
        // remove content
        $result.html("");

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
                    const loadPage = index => {
                        zip.file(book.content.find(x => x.id == book.spine[index]).href).async("text").then(txt => {
                            const page = $(txt);
                            for(const img of page.find("img")) {
                                const imgSrc = img.getAttribute("src");
                                zip.file(imgSrc).async("blob").then(blob => {
                                    const blobUrl = URL.createObjectURL(blob) // blob is the Blob object
                                    img.src = blobUrl;
                                });
                                img.classList.add("centered-image");
                                // console.log()
                                // console.log(img.attr("src"))
                            }
                            $result.append(page);
                            loadPage(index + 1);
                        });
                    }
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

