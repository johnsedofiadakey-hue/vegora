# VEGORA: running the store

A plain-language guide for the person who looks after the shop. You do not need to know anything about code.

Everything is done in the **Studio admin** at the website address followed by `/admin`, for example `https://vegora--vegoragh.europe-west4.hosted.app/admin`. Its menu has four sections: **Products**, **Orders**, **Website text** (called Content in older notes) and **Sign-ups**. On a computer the menu is down the left side; on a phone, tap the ☰ button at the top left.

**Getting a product ready to sell:** open **Products** and tap the product. Type the price, tap **+ S, M, L, XL** (or add other sizes), and enter how many of each size you have. The box at the top shows what is still missing; when everything is ticked, tap **Save and publish**. To take it off the shop again, tap **Hide from shop**. The stock code (SKU) is filled in automatically. Orders show a photo of each item, and the Orders menu item shows how many paid orders still need packing or delivery.

## Where things stand today

- The shop window is live: customers can browse and read about the pieces.
- **Nobody can buy yet.** Checkout is closed on purpose until payment testing, delivery prices and the real catalogue are ready. Everything below about orders describes how it will work once checkout opens.
- The seven T-shirts on the site are **previews**: their GH₵100 price is only a placeholder, and they have no sizes or stock.
- The home page is the opening photograph, a short introduction and then the **new arrivals** (up to eight products), followed straight by the footer. The arrivals are your products that are ticked **New arrival**, so there is nothing to update on the Homepage section except its words.
- The shop does **not send emails yet**. Once orders start, you will need to open the Orders tab to see them.

## Signing in

1. Go to the admin address and enter your email and password.
2. When you are finished on a shared computer, choose **Sign out** at the top right.
3. Never share your password. If someone else needs access, ask your developer to give them their own account.

## Products

**Draft or published.** A *draft* is private, so customers cannot see it. A *published* product appears on the site, but only if it has a **price, at least one photo, and at least one size with stock above zero**. This is deliberate: nothing half-finished can go live.

**Adding a product**

1. Choose **+ New product**.
2. Fill in the name, a short description, the collection (Men, Women or Unisex) and the category, such as T-Shirts.
3. **Web address name (slug):** letters, numbers and dashes only, for example `navy-wide-stripe-tee`. It cannot be changed later, so choose it carefully.
4. **Price** in cedis, for example `250.00`.
5. Tick **New arrival** or **Best seller** if they apply. New arrival items appear on the New In page.
6. **Photos:** add up to 12. The first one is the cover. Give each a short description of what it shows. Photographs are resized automatically for phones.
7. **Sizes and stock:** choose the sizes you offer. Each size needs a short stock code (called a SKU), for example `NAVY-M`, and the number you really have. Stock starts at zero, so enter the number.
8. Set the status to **Published** only when it is ready, then **Save product**.

**Removing a product from sale:** open it and choose **Archive**. It disappears from the site but is kept in the system.

**The seven preview styles** appear on the public site as labelled previews. In Products, choose **Import seven preview styles** to copy them into the admin as editable drafts. If they are already listed, the import leaves them unchanged. Replace each placeholder name and price, then add confirmed sizes and stock before publishing.

## Content: the words and pictures on the site

Open the **Content** tab. It has nine sections: Announcement bar, Homepage, Our Style page, About page, Contact and footer, Delivery information, Returns and exchanges, Privacy policy and Terms of sale.

**The key idea: saving a draft does not change the website. Only Publish does.**

1. Pick a section and change the text or photos.
2. **Save draft** keeps your work private.
3. **Publish** (it asks you to confirm) puts it on the live site. Check the live page afterwards using **View the live page** at the bottom of the section.
4. **Discard changes** throws away edits you have not published.
5. **Earlier versions** lets you load an older published version back into the draft. It goes live only when you publish it.

Things to know:

- Text is plain: no bold or links inside paragraphs. Separate paragraphs with a blank line.
- Every photo needs a short description (for people who cannot see it). When you upload a new photo you must write a new description.
- Sections have length limits and show a counter. Short, confident lines look best.
- **Homepage:** the opening words, the short introduction, and the heading above the new arrivals. The arrivals themselves come from Products (tick **New arrival**).
- **Announcement bar:** a single line above the menu on every page. Switch it on, write the message, and publish. Switch it off the same way.
- **Delivery, Returns, Privacy and Terms** pages stay hidden, and are not linked from the footer, until you publish text for them. Use wording you or your adviser have approved. Do not copy another shop's policy.
- **Contact and footer:** fill in the channels you actually answer (email, phone, WhatsApp) and your social accounts (Instagram, TikTok, Facebook, X). Type the username only, without the @ or the web address; for Facebook, use the part after facebook.com/. A Contact page and footer link appear once at least one is filled in, and each social account also shows under **Follow** in the footer.
- There is **no preview yet**: publish, then look at the live page. If you do not like it, load the earlier version and publish again.

Changes appear within about half a minute. If you do not see a change, refresh the page once more after waiting.

## Sign-ups

The footer of every page has a "Get our news" box under the VEGORA logo where visitors leave their email address for new arrivals and offers. Open the **Sign-ups** tab to see them.

- Filter by interest, **Copy emails** to paste into your email program, or **Download spreadsheet** to open in Excel or Google Sheets.
- **Remove** takes someone off the list (it asks you to confirm). Do this if a person asks you to delete their details.
- The same person signing up again is merged into one entry, with their new interests added.
- **Nothing is emailed to them automatically.** You contact them yourself. Only write to people about what they ticked.
- Because this collects personal details, publish your **Privacy policy** text (Content tab). The form links to it once it is live.

## Orders

Each order has an **order number** like `VG-7K2M9QXA`. Customers see this number, so ask for it when they get in touch.

**Payment status** (set automatically; you cannot change it by hand):

| Status | Meaning |
|---|---|
| pending payment | The customer has started paying and the stock is held for 30 minutes. |
| paid | Payment was confirmed with the payment company. Only now should you prepare the order. |
| failed or expired | Payment did not happen. The stock goes back on sale automatically. |
| review required | Something did not add up, for example a payment arriving after the hold expired. **Do not ship.** Contact your developer. |

**Delivery progress** (you set this, and only for paid orders): **Preparing, then Dispatched, then Delivered.**

1. Open the order and choose the next step.
2. To mark it **Dispatched** you must enter the delivery company or rider and a tracking reference. The customer sees both.
3. If you picked a step by mistake you can move back **one** step. **Delivered is final.**
4. **Internal note** is only for your team. Customers never see it.

Customers follow their order on the **Track order** page (link in the footer) with their order number and the **phone number** they gave when they ordered. They see a progress bar (Order confirmed, Preparing, On its way, Delivered), the dates, what they ordered with the totals, and the tracking reference once dispatched. The page re-checks by itself every minute while it is open. They never see their address or anyone else's details.

**Because the shop sends no emails or texts**, the customer is told in three places to keep their order number: a notice on the checkout page before paying, and, right after paying, a large order-number card with **Copy number**, **Save as picture** and **Share** buttons plus a "take a screenshot now" reminder. If they tick "Remember this order on this device", their next visit to Track order lists the order with a single **View** button (it is kept only in their own browser).

**When a customer rings or messages you:**
- Keep each order moving: open **Orders**, pick the order, and set the next step. That is what the customer sees; there is no other message to send.
- Use the **search box** at the top of the Orders list. You can type their order number, their name or their phone number.
- **If they lost their order number**, search by the phone number they give, confirm it is theirs (for example, ask for the items or delivery area), and tell them the number.

## What customers see now (changed 2 November 2026)

- **Checkout asks for four things only:** full name, phone number, delivery area (Accra or Tema, each shows its price) and one delivery address box. There is no email field. Customers pay with Paystack.
- **The cart.** The shop now says **cart** everywhere, not "bag" (Add to cart, Your cart). Old `/bag` links go to the cart by themselves.
- **Plain English.** The home page, product, cart, checkout, order tracking and footer wording was rewritten in short, simple words. The page called "The Edit" is now **Our Style**, and "New In" is **New Clothes**. If you had already published your own wording for the Homepage, Our Style or About sections in the Content tab, those texts stay as you wrote them; open each section and change them if you want them simpler too.
- **Your phone is how customers are found.** Customers look up an order with the order number and their phone number. In the Orders tab, the customer's phone number is shown (tap it to call), and you can search by phone number.

## Before checkout can open

These need your decisions. Your developer will do the technical side:

1. **Delivery areas and prices:** which regions or cities you deliver to and what each costs. Nothing is assumed, and checkout cannot open without this.
2. **Real products:** names, prices, sizes and stock, and women's pieces and photos if you want a women's section.
3. **Policy text:** delivery times, returns and exchanges, privacy, terms of sale, and your contact details.
4. **Who answers customers** and how returns and refunds work, including tax.
5. A **Paystack** account in test mode, then live mode when you are ready. Live payments need your explicit approval.

## If something looks wrong

| Problem | What to do |
|---|---|
| I cannot sign in | Check the email and password. If it still fails, ask your developer to reset it. |
| I saved but the site did not change | Saving a draft never changes the site. Use **Publish**. |
| "Someone else changed this section" | Another person edited it first. Choose **Reload this section**, then redo your edit. |
| A product will not publish | It needs a price, a photo, and at least one size with stock above zero. |
| A page I wrote returns "not found" | Delivery, Returns, Privacy and Terms are hidden until text is published. |
| An order says "review required" | Do not ship. Contact your developer with the order number. |

## Keeping the shop safe

- The system keeps **7 days** of history behind the scenes. If something important is deleted by mistake, tell your developer straight away.
- Site monitoring and email alerts are configured; ask your developer to confirm alert delivery if the site has a problem.
- Never send your password or payment keys by message or email.
