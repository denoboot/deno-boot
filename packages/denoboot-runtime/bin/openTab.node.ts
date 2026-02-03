// import { execSync } from "node:child_process"
// import os from "node:os"

// export function openTab(url: string, browser = "Google Chrome") {
//   const platform = os.platform()

//   if (platform === "darwin") {
//     execSync(`osascript -l JavaScript scripts/openChrome.jxa.js "${url}" "${browser}"`)
//     return
//   }

//   if (platform === "win32") {
//     execSync(`start "" "${url}"`, { shell: "cmd.exe" })
//     return
//   }

//   execSync(`xdg-open "${url}"`)
// }
export {};
