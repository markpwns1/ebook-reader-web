
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

const goto = link => {
    const foundContent = book.content.find(x => x.href == link.substring(0, link.indexOf("#") < 0? link.length : link.indexOf("#")));
    const foundSpineEntry = book.spine.find(x => x == foundContent.id);
    const index = book.spine.indexOf(foundSpineEntry);

    const onReady = () => {
        const url = location.href;
        if(link.includes("#")) {
            location.href = link.substring(link.indexOf("#"));
            history.replaceState(null, null, url); 
        }
        else {
            location.href = "#GOTO_" + link.hashCode();
            console.log("#GOTO_" + link.hashCode());
            history.replaceState(null, null, url); 
        } 
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

    if(loading) return;
    if(index < currentPage) return;
    if(index >= book.spine.length) return;

    let oldCurrentPage = currentPage;
    currentPage = index;
    loading = true;

    const content = book.content.find(x => x.id == book.spine[index]);

    book.zip.file(content.href).async("text").then(txt => {
        loaded.push(content.href);
        const $a = $("<a id='GOTO_" + content.href.hashCode() + "' ></a>");
        const $page = $(txt);

        for(const img of $page.find("img")) {
            const imgSrc = img.getAttribute("src");
            book.zip.file(imgSrc).async("blob").then(blob => {
                img.src = URL.createObjectURL(blob);
            });
            img.classList.add("centered-image");
        }

        for (const img of $page.find("image")) {
            const $newImage = $(img);
            book.zip.file($newImage.attr("xlink:href")).async("blob").then(blob => {
                $newImage.attr("xlink:href", URL.createObjectURL(blob));
            });
        }

        for (const a of $page.find("a")) {
            const $a = $(a);
            const link = $a.attr("href");
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
        // loadPage(index + 1);
    }).catch(error => {
        currentPage = oldCurrentPage;
        loading = false;
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
            goto(item.link);
        });
        $item.append($a);
        $toc.append($item);
    }

    $("#book-title").text(book.title);
}

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
            
            zip.file("toc.ncx").async("text").then(txt => {
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
                loadPage(0);
            });
        });
    }, function (e) {
        console.log("Error reading " + f.name + ": " + e.message);
    });
}


window.onload = () => {

    $content = $("#content");
    $content.html("");

    let $files = $("#file");
    if($files[0].files.length > 0)
        handleFile($files[0].files[0]);

    $("#btn-load-more").click(() => {
        loadPage(currentPage + 1);
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

    window.onscroll = function(ev) {
        if ((window.innerHeight + window.scrollY) >= document.body.scrollHeight - 50) {
            // alert("HELLO");
            loadPage(currentPage + 1);
        }
    };

    $("#file").on("change", function(evt) {
        $content.html("");

        var files = evt.target.files;
        for (var i = 0; i < files.length; i++) {
            handleFile(files[i]);
        }
    });
}

