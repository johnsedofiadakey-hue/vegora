import Link from "next/link";
import { getContent } from "@/lib/server/site-content-cache";

// One line above the header, written in the admin. It renders nothing unless
// the owner has switched it on and given it a message.
export async function AnnouncementBar() {
  const content = await getContent("announcement");
  if (!content.enabled || !content.text) return null;
  const external = content.link.startsWith("https://");
  return <div className="announcement-bar" role="region" aria-label="Announcement">
    {!content.link ? <span>{content.text}</span>
      : external ? <a href={content.link} target="_blank" rel="noreferrer">{content.text}</a>
      : <Link href={content.link}>{content.text}</Link>}
  </div>;
}
