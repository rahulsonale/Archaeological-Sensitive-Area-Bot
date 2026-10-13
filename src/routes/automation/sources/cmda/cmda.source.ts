import { chromium } from "playwright";
import { CmdaMapResult } from "./cmda.types";

const CMDA_PAGE_URL =
  "https://www.cmdachennai.gov.in/ArchaeologicalSensitiveAreaMaps/ASAmaps.aspx";

export async function findCmdaMap(villageName: string): Promise<CmdaMapResult> {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    await page.goto(CMDA_PAGE_URL, { waitUntil: "domcontentloaded" });

    const options = await page.locator("#ddlmapname").evaluate((element) => {
      const select = element as HTMLSelectElement;

      return Array.from(select.options).map((option) => ({
        label: option.text.trim(),
        value: option.value,
      }));
    });

    const village = options.find(
      (option) =>
        option.label.toLowerCase() === villageName.trim().toLowerCase() &&
        option.value !== "",
    );

    if (!village) {
      throw new Error(
        `Village "${villageName}" is not listed on the CMDA page.`,
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
  } finally {
    await browser.close();
  }
}
