
class Renderer {
    /**
     * @type Book
     */
    book;

    loading = false;

    constructor(book) {
        this.book = book;
    }

    processPage(file, onsuccess, onerror, options) {
        if(this.loading) return;

        this.loading = true;

        const dir = getDirFromPath(file.href);

        this.book.openFile(file.href, "text", txt => {
            const $a = $("<a id='GOTO_" + file.id.hashCode() + "' ></a>");

            // for (let i = 0; i < txt.length; i++) {
            //     const c = txt[i];
            //     if(c == "<" && c == "") {

            //     }
            // }

            txt = txt.replace(/<script /g, "<erased ");

            const $page = $("<div>" + txt + "</div>");
            // console.log(txt);
            for(const img of $page.find("img")) {

                this.book.openFile(appendPath(dir, img.getAttribute("src")), "blob", blob => {
                    img.src = URL.createObjectURL(blob);
                    const $a = $("<a target='_blank' href='" + URL.createObjectURL(blob) + "'></a>");
                    $a.append($(img));
                    $page.append($a);
                });
                img.classList.add("centered-image");
                img.parentNode.removeChild(img);
            }

            for (const img of $page.find("image")) {
                const $newImage = $(img);
                this.book.openFile(appendPath(dir, $newImage.attr("xlink:href")), "blob", blob => {
                    $newImage.attr("xlink:href", URL.createObjectURL(blob));
                });
            }

            for (const a of $page.find("a")) {
                const $a = $(a);
                const link = $a.attr("href") || "";
                if(link.startsWith("http://") || link.startsWith("https://")) {
                    $a.attr("target", "_blank");
                    continue;
                }
                $a.removeAttr("href");

                if(options && options.gotoFn)
                    $a.click(() => {
                        options.gotoFn(file.href, link);
                    });
            }

            for (const element of $page.find("style")) {
                $(element).remove();
            }

            // for (const element of $page.find("script")) {
            //     $(element).remove();
            // }

            $page.find("*").removeAttr("style");
            
            $page.prepend($a);


            this.loading = false;
            if(onsuccess) onsuccess($page);

        }, e => {
            this.loading = false;
            if(onerror) onerror(e);
        });
    }

    render(file, $element, onsuccess, onerror, options) {
        this.processPage(file, $doc => {
            $element.append($doc);
            if(onsuccess) onsuccess($doc);
        }, onerror, options);
    }
}