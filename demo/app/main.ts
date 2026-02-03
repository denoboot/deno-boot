// decorators

const app: HTMLDivElement | null = document.getElementById(
  "app",
) as HTMLDivElement;
if (app) {
  app.textContent = "Hello, Deno Boot!";
}
