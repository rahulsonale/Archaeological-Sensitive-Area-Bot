import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";

import { openCmdaMapInBrowser } from "../routes/automation/sources/cmda/cmda.source";

const runFile = promisify(execFile);

function getPopplerExecutable(): string {
  const executableName =
    process.platform === "win32" ? "pdftoppm.exe" : "pdftoppm";
  const configuredPath = process.env.POPPLER_PATH;

  if (configuredPath) {
    const configuredExecutable =
      existsSync(configuredPath) &&
      !configuredPath.toLowerCase().endsWith(executableName.toLowerCase())
        ? join(configuredPath, executableName)
        : configuredPath;
    if (existsSync(configuredExecutable)) return configuredExecutable;
  }

  const bundledRuntimeExecutable = join(
    homedir(),
    ".cache",
    "codex-runtimes",
    "codex-primary-runtime",
    "dependencies",
    "native",
    "poppler",
    "Library",
    "bin",
    executableName,
  );
  if (existsSync(bundledRuntimeExecutable)) return bundledRuntimeExecutable;

  return executableName;
}

async function renderFirstPage(
  pdfPath: string,
  screenshotPath: string,
): Promise<void> {
  const outputPrefix = screenshotPath.slice(0, -".png".length);

  try {
    await runFile(getPopplerExecutable(), [
      "-f",
      "1",
      "-l",
      "1",
      "-singlefile",
      "-png",
      pdfPath,
      outputPrefix,
    ]);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "unknown error";
    throw new Error(
      `Could not create the PNG map screenshot. ${reason}. Set POPPLER_PATH to the Poppler bin folder if it is installed elsewhere.`,
    );
  }
}

async function openResultsPage(): Promise<void> {
  const url = "http://localhost:4200";

  try {
    if (process.platform === "win32") {
      await runFile("cmd", ["/c", "start", "", url]);
    } else if (process.platform === "darwin") {
      await runFile("open", [url]);
    } else {
      await runFile("xdg-open", [url]);
    }
  } catch {
    console.warn(`Could not open the results page automatically. Open ${url}`);
  }
}

async function main(): Promise<void> {
  const terminal = createInterface({ input, output });
  const location =
    process.argv.slice(2).join(" ").trim() ||
    (await terminal.question("Enter a Chennai village or place: ")).trim();
  terminal.close();

  if (!location) {
    throw new Error("Enter a village or place to search.");
  }

  console.log(`Opening the CMDA site and searching for ${location}...`);
  const session = await openCmdaMapInBrowser(location);

  try {
    const outputDirectory = join(process.cwd(), "output");
    await mkdir(outputDirectory, { recursive: true });

    const fileBaseName = session.result.village
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const screenshotPath = join(outputDirectory, `${fileBaseName}-map.png`);
    const pdfPath = join(outputDirectory, `${fileBaseName}-map.pdf`);
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "asa-map-"));
    const temporaryPdfPath = join(temporaryDirectory, "map.pdf");
    const temporaryScreenshotPath = join(temporaryDirectory, "map.png");
    let savedScreenshotPath = screenshotPath;
    let savedPdfPath = pdfPath;

    try {
      await session.downloadPdf(temporaryPdfPath);
      await renderFirstPage(temporaryPdfPath, temporaryScreenshotPath);

      try {
        await copyFile(temporaryPdfPath, pdfPath);
      } catch (error: unknown) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "EBUSY" && code !== "EPERM" && code !== "EACCES") {
          throw error;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        savedPdfPath = join(
          outputDirectory,
          `${fileBaseName}-map-${timestamp}.pdf`,
        );
        await copyFile(temporaryPdfPath, savedPdfPath);
      }

      try {
        await copyFile(temporaryScreenshotPath, screenshotPath);
      } catch (error: unknown) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "EBUSY" && code !== "EPERM" && code !== "EACCES") {
          throw error;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const alternatePath = join(
          outputDirectory,
          `${fileBaseName}-map-${timestamp}.png`,
        );
        await copyFile(temporaryScreenshotPath, alternatePath);
        savedScreenshotPath = alternatePath;
      }
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }

    const latestResult = {
      village: session.result.village,
      mapImageUrl: `http://localhost:3000/output/${encodeURIComponent(
        basename(savedScreenshotPath),
      )}`,
      sourceUrl: session.result.sourceUrl,
      mapUrl: session.result.mapUrl,
      generatedAt: new Date().toISOString(),
      remarks: [
        {
          zone: "Outside the orange boundary",
          remark:
            "Outside the archaeological restriction area shown on this map. Confirm title, ownership, land use, zoning, access, and other planning requirements before proceeding.",
        },
        {
          zone: "Inside the orange boundary, outside the pink boundary",
          remark:
            "Within the regulated area shown on this map. Construction or other development may require prior approval. Verify the official boundary, site-specific notification, and required permissions with the competent authority.",
        },
        {
          zone: "Inside the pink boundary",
          remark:
            "Within the prohibited area shown on this map. New construction or reconstruction is generally restricted. Confirm the exact boundary, applicable rules, and any exceptions with the competent authority.",
        },
        {
          zone: "Overlapping the green notified site",
          remark:
            "Within the notified protected site shown on this map. Treat as highly restricted and obtain official confirmation before considering property or development action.",
        },
      ],
      note: "These are general zone explanations from the map legend. The bot has not assessed individual plots.",
    };

    await writeFile(
      join(outputDirectory, "latest-result.json"),
      JSON.stringify(latestResult, null, 2),
      "utf8",
    );

    console.log(`Selected CMDA village: ${session.result.village}`);
    console.log(`Map PDF saved to: ${savedPdfPath}`);
    console.log(`Map screenshot saved to: ${savedScreenshotPath}`);
    console.log("Latest map remarks saved to: output/latest-result.json");

    await openResultsPage();
  } finally {
    await session.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Map search failed.");
  process.exitCode = 1;
});
