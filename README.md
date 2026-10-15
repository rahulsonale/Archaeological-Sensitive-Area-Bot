# Archaeological Sensitive Area Bot API

This service looks up the official CMDA archaeological sensitive-area map for a Chennai-region village. It can be called from Postman or integrated into another application.

## Run the API

From the project root, start the development server:

```sh
npm run dev
```

The API listens on `http://localhost:3000` by default.

## Run the visible browser bot

To open the CMDA website, automatically select a village, and display its map in a visible browser window, run this from the project root:

```sh
npm run bot -- Tondiarpet
```

Replace `Tondiarpet` with the village to search. If you run `npm run bot` without a name, the bot asks for one in the terminal. It downloads the PDF to a temporary location, saves a copy as `output/<village>-map.pdf`, renders its first page as `output/<village>-map.png`, removes the temporary files, then closes the browser. The PNG contains the map itself rather than the browser's PDF viewer. If an existing PDF or PNG is open and locked, the bot saves a timestamped copy of that file instead.

PDF screenshots are rendered with Poppler's `pdftoppm` command. The bot checks the terminal `PATH` and the bundled Codex Poppler location automatically. If Poppler is installed elsewhere, set `POPPLER_PATH` to its `bin` folder.

## Search by location in the URL

If your main project extracts a place name from a document, pass that extracted name as the `location` query parameter. The bot will select the matching CMDA village and retrieve its map.

For a JSON result, send a `GET` request to:

```text
http://localhost:3000/api/cmda/map?location=Pallavaram
```

The response includes the matched village and `mapUrl`. To open or display the map directly in a browser, use:

```text
http://localhost:3000/api/cmda/map/open?location=Pallavaram
```

That endpoint looks up the map and redirects the browser to the returned CMDA map/PDF URL.

## Search for a map in Postman

- Method: `POST`
- URL: `http://localhost:3000/api/cmda/map`
- Header: `Content-Type: application/json`
- Body type: raw JSON

The POST request also accepts a village name in the JSON body:

```json
{
  "location": "Pallavaram"
}
```

`place` and `village` are also accepted. GET accepts the same names as query parameters. The lookup matches a CMDA village name (case-insensitively) and can resolve a unique partial match.

Successful response (`200`):

```json
{
  "source": "cmda",
  "status": "success",
  "village": "Pallavaram",
  "mapUrl": "https://...",
  "sourceUrl": "https://www.cmdachennai.gov.in/ArchaeologicalSensitiveAreaMaps/ASAmaps.aspx"
}
```

`mapUrl` is the official map/PDF URL returned by CMDA and can be opened directly or consumed by the integrating project.

Errors return JSON with `source`, `status: "error"`, and a `message`. HTTP `400` means the request is missing a place or matches multiple villages; `404` means the place is not listed; `502` means CMDA could not be reached or did not return a map.
