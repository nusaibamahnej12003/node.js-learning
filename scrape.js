const cheerio = require("cheerio");

async function scrapeWebsite() {
    const response = await fetch("https://quotes.toscrape.com/");

    const html = await response.text();

    const $ = cheerio.load(html);

    const quotes = [];

    $(".quote").each((index, element) => {
        const quote = $(element);

        const text = quote.find(".text").text();
        const author = quote.find(".author").text();

        const tags = quote.find(".tag")
            .map((i, tag) => $(tag).text())
            .get();

        quotes.push({
            text,
            author,
            tags
            });
    });

    console.log(quotes);
}

scrapeWebsite();