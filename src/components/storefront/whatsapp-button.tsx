import { contactHref } from "@/lib/site-content";
import { getContent } from "@/lib/server/site-content-cache";

// The green WhatsApp button that floats over every shop page. It uses the WhatsApp
// number from Website text > Contact and footer, and is not drawn until one is saved.
export async function WhatsAppButton() {
  const contact = await getContent("contact");
  const number = typeof contact.whatsapp === "string" ? contact.whatsapp : "";
  if (!number) return null;
  const message = "Hello VEGORA, I have a question.";
  return <a className="whatsapp-float" href={`${contactHref("whatsapp", number)}?text=${encodeURIComponent(message)}`}
    target="_blank" rel="noopener noreferrer" aria-label="Chat with us on WhatsApp">
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M16.04 3C8.84 3 3 8.83 3 16.02c0 2.3.6 4.55 1.75 6.53L3 29l6.6-1.73a13.03 13.03 0 0 0 6.44 1.65h.01c7.19 0 13.03-5.84 13.03-13.03C29.08 8.7 23.23 3 16.04 3Zm0 23.7h-.01a10.8 10.8 0 0 1-5.5-1.51l-.4-.23-3.92 1.03 1.05-3.82-.26-.4a10.75 10.75 0 0 1-1.65-5.75c0-5.95 4.85-10.8 10.82-10.8 2.89 0 5.6 1.12 7.64 3.17a10.73 10.73 0 0 1 3.16 7.65c0 5.96-4.85 10.66-10.93 10.66Zm5.93-8.08c-.32-.16-1.92-.95-2.22-1.05-.3-.11-.51-.16-.73.16-.22.32-.84 1.05-1.03 1.27-.19.22-.38.24-.7.08-.33-.16-1.37-.5-2.6-1.6-.96-.86-1.6-1.91-1.8-2.23-.18-.32-.02-.5.14-.66.15-.14.33-.38.49-.57.16-.19.22-.32.33-.54.11-.22.05-.4-.03-.57-.08-.16-.73-1.76-1-2.4-.26-.63-.53-.54-.73-.55h-.62c-.22 0-.57.08-.87.4-.3.32-1.14 1.11-1.14 2.7 0 1.6 1.17 3.15 1.33 3.37.16.22 2.3 3.5 5.57 4.91.78.34 1.38.54 1.86.69.78.25 1.49.21 2.05.13.63-.09 1.92-.78 2.19-1.54.27-.76.27-1.4.19-1.54-.08-.14-.3-.22-.62-.38Z" />
    </svg>
  </a>;
}
