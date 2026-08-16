const fontFiles = import.meta.glob("/public/fonts/*.ttf", {
    query: "?url",
    import: "default",
    eager: true,
});

export const FONT_OPTIONS = Object.keys(fontFiles).map((filepath) => ({
    id: filepath.split("/").pop().replace(".ttf", ""),
    label: filepath.split("/").pop().replace(".ttf", "").replace(/_/g, " "),
    url: fontFiles[filepath],
}));
