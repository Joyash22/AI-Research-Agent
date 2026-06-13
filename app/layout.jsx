import "./globals.css";
export const metadata = {
  title: "AI Research Agent",
  description: "Multi-agent RAG research assistant powered by Claude",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
