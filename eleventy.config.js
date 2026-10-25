const yaml = require("js-yaml");

module.exports = function (eleventyConfig) {
  // YAML data files — register the parser explicitly
  eleventyConfig.addDataExtension("yaml", (contents) => yaml.load(contents));
  eleventyConfig.addDataExtension("yml",  (contents) => yaml.load(contents));

  // Copy images as-is
  eleventyConfig.addPassthroughCopy("src/images");

  // Copy habit 3D models as-is
  eleventyConfig.addPassthroughCopy("src/habits");

  // Inside your module.exports function
  eleventyConfig.addPassthroughCopy("src/admin");

  // Shuffle filter
  eleventyConfig.addFilter("pickRandom", function (arr, n) {
    if (!Array.isArray(arr) || arr.length === 0) return [];
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "liquid",
  };
};