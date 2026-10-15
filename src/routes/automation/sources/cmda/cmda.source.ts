import { Browser, Page, chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import { CmdaMapResult } from "./cmda.types";

export const CMDA_PAGE_URL =
  "https://www.cmdachennai.gov.in/ArchaeologicalSensitiveAreaMaps/ASAmaps.aspx";

async function selectVillageAndOpenMap(
  page: Page,
  villageName: string,
): Promise<CmdaMapResult> {
  await page.goto(CMDA_PAGE_URL, { waitUntil: "domcontentloaded" });

  const options = await page.locator("#ddlmapname").evaluate((element) => {
    const select = element as HTMLSelectElement;

    return Array.from(select.options).map((option) => ({
      label: option.text.trim(),
      value: option.value,
    }));
  });

  const normalize = (value: string) =>
    value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const availableOptions = options.filter((option) => option.value !== "");
  const search = normalize(villageName);
  const exact = availableOptions.find(
    (option) => normalize(option.label) === search,
  );
  const partialMatches = exact
    ? []
    : availableOptions.filter((option) => {
        const label = normalize(option.label);
        return (
          (search.length >= 4 && label.includes(search)) ||
          search.includes(label)
        );
      });
  const village = exact ?? (partialMatches.length === 1 ? partialMatches[0] : undefined);

  if (!village) {
    if (partialMatches.length > 1) {
      throw new Error(
        "That place matches more than one CMDA village. Please enter a more specific village name.",
      );
    }
    throw new Error(
      `"${villageName}" is not listed as a CMDA village. Try choosing a village from the suggestions.`,
    );
  }

  await page.locator("#ddlmapname").selectOption(village.value);

  const mapTabPromise = page.waitForEvent("popup");
  await page.locator("#btnViewMap").click();

  const mapTab = await mapTabPromise;
  await mapTab.waitForLoadState("domcontentloaded");

  const mapFrame = mapTab.locator("iframe").first();
  await mapFrame.waitFor({ state: "attached", timeout: 10000 });

  const frameSource = await mapFrame.getAttribute("src");

  if (!frameSource) {
    throw new Error(
      `CMDA opened the map for "${village.label}", but no PDF was found.`,
    );
  }

  return {
    village: village.label,
    mapUrl: new URL(frameSource, mapTab.url()).href,
    sourceUrl: CMDA_PAGE_URL,
  };
}

export async function findCmdaMap(villageName: string): Promise<CmdaMapResult> {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    return await selectVillageAndOpenMap(page, villageName);
  } finally {
    await browser.close();
  }
}

export async function openCmdaMapInBrowser(
  villageName: string,
): Promise<{
  result: CmdaMapResult;
  downloadPdf: (filePath: string) => Promise<void>;
  close: () => Promise<void>;
}> {
  const browser: Browser = await chromium.launch({ headless: false });

  try {
    const page = await browser.newPage();
    const result = await selectVillageAndOpenMap(page, villageName);
    const mapTab = page.context().pages().at(-1);

    if (!mapTab || mapTab === page) {
      throw new Error("The CMDA map opened, but its browser tab could not be found.");
    }

    return {
      result,
      downloadPdf: async (filePath) => {
          const downloadPromise = page.waitForEvent("download", { timeout: 15000 });

          try {
            await page.locator("#btnDownloadMap").click();
            const download = await downloadPromise;
            await download.saveAs(filePath);
          } catch {
            const response = await page.context().request.get(result.mapUrl);
            if (!response.ok()) {
              throw new Error(`CMDA PDF download failed (HTTP ${response.status()}).`);
            }

            const pdf = await response.body();
            if (pdf.subarray(0, 5).toString() !== "%PDF-") {
              throw new Error("CMDA did not return a PDF for this village.");
            }
            await writeFile(filePath, pdf);
          }
      },
      close: () => browser.close(),
    };
  } catch (error: unknown) {
    await browser.close();
    throw error;
  }
}
