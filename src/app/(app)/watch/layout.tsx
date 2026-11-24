/** Watch pages share the reading width; the player itself lives in the app layout (it survives leaving the page). */
export default function WatchLayout({ children }: LayoutProps<"/watch">) {
  return <div className="mx-auto max-w-5xl">{children}</div>;
}
