async function api(path, init) {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...init?.body ? { "Content-Type": "application/json" } : {},
      ...init?.headers
    }
  });
  if (response.status === 204) return void 0;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
}
function csvDownload(filename, rows) {
  const content = rows.map((row) => row.map((value) => {
    const text = String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
export {
  api,
  csvDownload
};
