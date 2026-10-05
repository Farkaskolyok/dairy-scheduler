import { isTauri, invoke } from "@tauri-apps/api/core";

export async function saveCsv(name: string, contents: string): Promise<void> {
  if (isTauri()) {
    const [{ save }, { writeTextFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const path = await save({
      title: "Beosztás mentése",
      defaultPath: name,
      filters: [{ name: "Excel (CSV)", extensions: ["csv"] }],
    });
    if (path) await writeTextFile(path, contents);
    return;
  }

  const url = URL.createObjectURL(new Blob([contents], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // Allow the browser to start the download before releasing its source.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function printRoster(): Promise<void> {
  if (isTauri()) {
    await invoke("print_roster");
  } else {
    window.print();
  }
}
