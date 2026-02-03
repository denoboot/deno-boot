export async function openTab(url: string, browser = "Google Chrome") {
  const os = Deno.build.os;

  if (os === "darwin") {
    await new Deno.Command("osascript", {
      args: [
        "-l",
        "JavaScript",
        new URL("./openTab.jxa.js", import.meta.url).pathname,
        url,
        browser,
      ],
    }).output();
    return;
  }

  if (os === "windows") {
    await new Deno.Command("cmd", {
      args: ["/c", "start", url],
    }).output();
    return;
  }

  await new Deno.Command("xdg-open", { args: [url] }).output();
}
