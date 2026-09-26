# PhotoFramer

A small web app that works out how to fit photos for your picture frames onto as
few sheets of printer paper as possible, then prints them at exact size.

It is plain HTML, CSS and JavaScript with no build step and no server-side code, so it runs in any modern browser on
Windows, macOS, Linux, ChromeOS, Android and iOS. It can be installed as an app (PWA) and works offline once loaded.

## How to use

1. **Printer paper**: pick the paper in your printer (Letter, A4, photo paper, or a custom size) and set the
   margin your printer can't print on and the gap to leave between photos for cutting.
2. **Frame sizes**: add the size of each frame opening (tap a quick-add chip or enter a custom size) and how many
   prints you need of each.
3. **Photos** (optional): choose or drop photos. Each one is matched to the frame size closest to its shape; you
   can change the size and the number of copies.
4. **Layout & print**: see the packed sheets, how much paper is used, and what else would still fit in the free
   space. *Compare paper sizes* shows which paper wastes the least. Press **Print…**, pick your printer in the
   print dialog, and set scale to **100% / Actual size** with margins **None**.

> Web pages can't list or choose printers themselves on any OS, so printer selection happens in the
> system print dialog (which also offers "Save as PDF").

## Running it

- **Just open it**: double-click `index.html`. Everything works except offline caching.
- **Local server** (enables install/offline): `npm start` (or `python3 -m http.server 8000`) and open
  http://localhost:8000.
- **Host it**: copy the files to any static host. The included workflow `.github/workflows/pages.yml` deploys to
  GitHub Pages on every push to `main` (enable *Settings → Pages → Source: GitHub Actions* first). Once it is
  hosted, open it on a phone and use "Add to Home Screen" / "Install app".

Photos never leave your device. They are processed in the browser and are not uploaded anywhere.

## How the layout works

`js/packer.js` uses the MaxRects bin-packing algorithm and lets prints rotate 90°. It tries several placement
heuristics and orderings and keeps the result with the fewest sheets, preferring full sheets over several
half-empty ones. Photos are rotated to match their slot and cropped to fill it, or shown whole with the
"no cropping" option.

## Tests

```sh
npm test
```

## License

Released under the [MIT License](LICENSE). Copyright (c) 2026 Arvind Prakash.
