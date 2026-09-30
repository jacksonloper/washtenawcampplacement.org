# Washtenaw Camp Placement website (static version)

This is a trial copy of washtenawcampplacement.org built without WordPress.
Every page is a plain text file in [`content/`](content/). Pictures are in
[`public/images/`](public/images/). Note that the real site is
still WordPress.  This version is live at https://washtenawcampplacement.netlify.app/

The question this repo is meant to answer: **could you keep the site up to
date without WordPress?** There are two ways to edit it:

- **In the browser** at [`/admin/`](https://washtenawcampplacement.netlify.app/admin/),
  with forms and a live preview (Decap CMS). See [Editing in the browser](#editing-in-the-browser).
- **By editing the files** here on GitHub.

## Where things are

| To change…                         | In the editor               | Or edit this file                              |
| ---------------------------------- | --------------------------- | ---------------------------------------------- |
| A page's words or pictures         | Pages → the page            | `content/<page-name>.md` (home is `index.md`)  |
| The home page's number tiles       | Pages → Home → Number tiles | [`content/index.md`](content/index.md)         |
| The menu, footer, address, phone   | Site settings               | [`content/site.yml`](content/site.yml)         |
| Add a picture                      | Any image button            | Upload it to `public/images/`                  |

Good pages to look at first:

- [`content/volunteer.md`](content/volunteer.md): a typical page
- [`content/how-to-refer.md`](content/how-to-refer.md): has a question-and-answer list
- [`content/index.md`](content/index.md): the home page, the most complicated one

## How the text works

Pages are written in **Markdown**, which is ordinary text with a few symbols:

```markdown
# A big heading
## A smaller heading

A normal paragraph. **Bold words** and *italic words*.

- a bulleted
- list

[Link text](/how-to-apply/)
![Description of the picture](/images/2026/01/Mom-and-girls.jpg)
```

To edit on GitHub: open a file, click the pencil icon, make the change, then
click **Commit changes**.

## Page sections

Each page is a list of sections, top to bottom. In the editor each one is a
box you can open, drag to reorder or remove, and **Add section** makes a new
one. In the file they look like this:

```yaml
sections:
  - type: text            # plain text
    body: |-
      # A heading
      Some words.
  - type: band            # full-width coloured stripe
    color: '#d6efb0'
    body: |-
      Text on the stripe.
  - type: columns         # side by side; stacked on phones
    layout: 3/4 1/4
    columns:
      - body: |-
          Left side (three quarters wide)
      - body: |-
          Right side (one quarter wide)
  - type: stats           # the home page's number tiles
    items:
      - number: '140'
        caption: Camperships awarded for the summer of 2026
        shape: person     # circle, person, bill or plain
```

Inside any text there are two special boxes. The editor shows them as small
forms (the **+** button in the text toolbar adds one):

```markdown
::: details Question shown on the button {open}
Answer that opens when clicked. Leave off {open} to start it closed.
:::

::: quote
Green emphasised text.
:::
```

A few buttons are written as HTML (`<a href="…" style="…">`). Change the words
and the link, and leave the rest alone.

## Editing in the browser

Go to **/admin/** on the site and log in with GitHub. Every **Publish** saves a
change here as a commit, and Netlify rebuilds the site in about a minute. On a
pull request's deploy preview, `/admin/` saves to that pull request's branch
instead, so you can try things without touching the live site.

Anyone who edits needs a GitHub account with write access to this repository
(Settings → Collaborators).

**One-time setup** (already done if logging in works):

1. On GitHub: Settings → Developer settings → OAuth Apps → **New OAuth App**.
   Homepage URL `https://washtenawcampplacement.netlify.app`, callback URL
   `https://api.netlify.com/auth/done`. Note the client ID and make a client secret.
2. On Netlify: Site configuration → Access & security → OAuth →
   **Install provider** → GitHub, and paste the client ID and secret.

The editor's settings are in [`admin/config.yml`](admin/config.yml), and its
preview and special boxes in [`src/admin.js`](src/admin.js).

## Previewing on your own computer (optional)

Needs [Node.js](https://nodejs.org/).

```bash
npm install
npm run dev
```

Then open http://localhost:5173. `npm run build` makes the finished site in `dist/`.

To use the editor on your own computer without logging in, also run
`npm run cms` in a second terminal and open http://localhost:5173/admin/.
It saves straight to the files on disk.

## How this was made

The pages were converted automatically from the WordPress database. A
word-by-word comparison with the live site found no differences on any of the
16 pages. The converter is in [`tools/convert.mjs`](tools/convert.mjs). It
isn't needed again unless the WordPress pages change before a switch.
[`tools/to_sections.mjs`](tools/to_sections.mjs) then moved each page's layout
into the `sections:` list the editor uses; the built pages came out identical.
