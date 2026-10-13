import * as fs from "fs";
import * as path from "path";
import { chromium } from "playwright";

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: false });

  try {
    const page = await browser.newPage();

    await page.goto(
      "https://www.cmdachennai.gov.in/ArchaeologicalSensitiveAreaMaps/ASAmaps.aspx",
      { waitUntil: "domcontentloaded" },
    );

    const details = await page.evaluate(() => {
      const villageSelect =
        document.querySelector<HTMLSelectElement>("#ddlmapname");
      const viewMap = document.querySelector<HTMLAnchorElement>("#btnViewMap");
      const downloadMap =
        document.querySelector<HTMLAnchorElement>("#btnDownloadMap");

      return {
        title: document.title,
        villageOptions: villageSelect
          ? Array.from(villageSelect.options).map((option) => ({
              label: option.text.trim(),
              value: option.value,
            }))
          : null,
        viewMap: viewMap
          ? {
              href: viewMap.href,
              target: viewMap.target,
              onclick: viewMap.getAttribute("onclick"),
            }
          : null,
        downloadMap: downloadMap
          ? {
              href: downloadMap.href,
              target: downloadMap.target,
              onclick: downloadMap.getAttribute("onclick"),
            }
          : null,
      };
    });

    console.log(JSON.stringify(details, null, 2));

    await page.locator("#ddlmapname").selectOption("Pallavaram.pdf");

    let mapResponseInfo: {
      url: string;
      status: number;
      contentType?: string;
      contentDisposition?: string;
    } | null = null;

    page.context().on("response", (response) => {
      if (response.url().includes("ASAMapDisplayer.aspx")) {
        const headers = response.headers();

        mapResponseInfo = {
          url: response.url(),
          status: response.status(),
          contentType: headers["content-type"],
          contentDisposition: headers["content-disposition"],
        };
      }
    });

    const mapTabPromise = page.waitForEvent("popup");
    await page.locator("#btnViewMap").click();

    const mapTab = await mapTabPromise;
    await mapTab.waitForLoadState("domcontentloaded");

    console.log("Map tab URL:", mapTab.url());
    console.log("Map tab title:", await mapTab.title());
    console.log("Map response:", mapResponseInfo);

    const outputDir = path.join(process.cwd(), "output");
    fs.mkdirSync(outputDir, { recursive: true });
    await page.screenshot({
      path: path.join(outputDir, "cmda-page.png"),
      fullPage: true,
    });
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error("CMDA inspection failed:", error);
  process.exitCode = 1;
});
