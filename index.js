
String.prototype.hashCode = function() {
    var hash = 0, i, chr;
    if (this.length === 0) return hash;
    for (i = 0; i < this.length; i++) {
      chr   = this.charCodeAt(i);
      hash  = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  };

const book = { 
    zip: null,
    title: null,
    content: [ ],
    spine: [ ],
    tableOfContents: [ ]
}

let $content;
let currentPage = 0;
let loaded = [ ];
let loading = false;
let root = "";

const goto = (link, callback) => {
    const foundContent = book.content.find(x => x.href == root + link.substring(0, link.indexOf("#") < 0? link.length : link.indexOf("#")));
    const foundSpineEntry = book.spine.find(x => x == foundContent.id);
    const index = book.spine.indexOf(foundSpineEntry);

    const onReady = () => {
        const url = location.href;
        if(link.includes("#")) {
            link = root + link;
            location.href = link.substring(link.indexOf("#"));
            history.replaceState(null, null, url); 
        }
        else {
            location.href = "#GOTO_" + (root + link).hashCode();
            // console.log("#GOTO_" + link.hashCode());
            history.replaceState(null, null, url); 
        } 
        if(callback) callback();
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
};

const loadPage = (index, callback) => {

    console.log("Verifying valid load...");

    if(loading) return;
    if(index < currentPage) return;
    if(index >= book.spine.length) return;

    console.log("Loading");
    let oldCurrentPage = currentPage;
    currentPage = index;
    loading = true;

    const content = book.content.find(x => x.id == book.spine[index]);

    book.zip.file(content.href).async("text").then(txt => {
        loaded.push(content.href);
        const $a = $("<a id='GOTO_" + content.href.hashCode() + "' ></a>");
        const $page = $("<div>" + txt + "</div>");

        for(const img of $page.find("img")) {
            const imgSrc = img.getAttribute("src").replace("./", "");
            // console.log(root + imgSrc);
            book.zip.file(root + imgSrc).async("blob").then(blob => {
                img.src = URL.createObjectURL(blob);
            });
            img.classList.add("centered-image");
        }

        for (const img of $page.find("image")) {
            const $newImage = $(img);
            book.zip.file(root + $newImage.attr("xlink:href")).async("blob").then(blob => {
                $newImage.attr("xlink:href", URL.createObjectURL(blob));
            });
        }

        for (const a of $page.find("a")) {
            const $a = $(a);
            const link = $a.attr("href");
            if(link.startsWith("http://") || link.startsWith("https://")) {
                $a.attr("target", "_blank");
                continue;
            }
            $a.removeAttr("href");
            $a.click(() => {
                goto(link);
            });
        }

        // $a.append($page);
        $content.append($a);
        $content.append($page);
        loading = false;

        if(callback) callback();

        detectNextPageLoad();
        // loadPage(index + 1);
    }).catch(error => {
        currentPage = oldCurrentPage;
        loading = false;
        console.log(error);
    });
}

function populateTableOfContents() {
    $(".toc-holder").show();
    const $toc = $("#table-of-contents");
    for (const item of book.tableOfContents) {
        const $item = $(document.createElement("li"));
        const $a = $(document.createElement("a"));
        $a.text(item.label);
        $a.click(() => {
            goto(item.link, closeMenu);
        });
        $item.append($a);
        $toc.append($item);
    }

    $("#book-title").text(book.title);
}

function closeMenu() {
    $(".overlay").hide();
}

function handleFile(f) {


    JSZip.loadAsync(f)
    .then(function(zip) {
        book.zip = zip;

        zip.file("META-INF/container.xml").async("text").then(txt => {
            const $containerXML = $($.parseXML(txt));
            const contentFile = $containerXML.find("rootfile").attr("full-path");

            zip.file(contentFile).async("text").then(txt => {
                // console.log(contentFile);
                if(contentFile.includes("/")) {
                    root = contentFile.substring(0, contentFile.lastIndexOf("/") + 1)
                }
                const parser = new DOMParser();
                const doc = parser.parseFromString(txt, "application/xhtml+xml");
                const items = doc.getElementsByTagName("item");
                for (const item of items) {
                    book.content.push({
                        href: root + item.getAttribute("href"),
                        id: item.getAttribute("id"),
                        mediaType: item.getAttribute("media-type")
                    });
                }
                const spineItems = doc.getElementsByTagName("itemref");
                for (const spineItem of spineItems) {
                    book.spine.push(spineItem.getAttribute("idref"));
                }
                
                const ncxFile = book.content.find(x => x.id == "ncx" && x.mediaType == "application/x-dtbncx+xml");
                if(ncxFile) {
                    // console.log(ncxFile);
                    // console.log(book.content);
                    zip.file(ncxFile.href).async("text").then(txt => {
                        const $xml = $($.parseXML(txt));
                        book.title = $xml.find("docTitle>text").text();
                        let navPoints = $xml.find("navPoint");
                        navPoints = navPoints.sort((a, b) => a.playOrder - b.playOrder)
                        for (const navPoint of navPoints) {
                            book.tableOfContents.push({
                                label: $(navPoint).find("text").text(),
                                link: $(navPoint).find("content").attr("src")
                            });
                        }
        
                        populateTableOfContents();
                        loadPage(0, closeMenu);
                    });
                }
                else {
                    populateTableOfContents();
                    loadPage(0, closeMenu);
                }
                
            });
        });
        
    }, function (e) {
        console.log("Error reading " + f.name + ": " + e.message);
    });
}

const detectNextPageLoad = () => {
    if ((window.innerHeight + window.scrollY) >= document.body.scrollHeight - 50) {
        loadPage(currentPage + 1);
    }
};

$(document).ready(() => {

    $content = $("#content");
    // $content.html("");

    let $files = $("#file");
    if($files[0].files.length > 0) {
        $content.html("");
        handleFile($files[0].files[0]);
    }

    $("#btn-open-file").click(() => {
        $files.trigger('click');
    });

    $("#btn-load-more").click(() => {
        loadPage(currentPage + 1);
    });

    $("#btn-scroll-to-top").click(() => {
        window.scrollTo(0, 0); 
        closeMenu();
    });

    var viewFullScreen = document.getElementById("fullscreen");
    if (viewFullScreen) {
        viewFullScreen.addEventListener("click", function() {
            var docElm = document.documentElement;
            if (docElm.requestFullscreen) {
                docElm.requestFullscreen();
            } else if (docElm.msRequestFullscreen) {
                docElm.msRequestFullscreen();
            } else if (docElm.mozRequestFullScreen) {
                docElm.mozRequestFullScreen();
            } else if (docElm.webkitRequestFullScreen) {
                docElm.webkitRequestFullScreen();
            }
        });
    }

    window.onscroll = detectNextPageLoad;

    $("#file").on("change", function(evt) {
        $content.html("");

        var files = evt.target.files;
        for (var i = 0; i < files.length; i++) {
            handleFile(files[i]);
        }
    });

    $("#btn-menu").click(() => {
        $(".overlay").show();
    });

    $("#btn-exit-menu").click(() => {
        $(".overlay").hide();
    });
});

