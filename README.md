# Washtenaw Camp Placement website (static version)

This is a trial copy of washtenawcampplacement.org built without WordPress.
Every page is a plain text file in [`content/`](content/). Pictures are in
[`public/images/`](public/images/). Nothing here is live yet: the real site is
still WordPress.  Live at https://washtenawcampplacement.netlify.app/

The question this repo is meant to answer: **could you keep the site up to
date by editing these files?** Have a look at a few pages and decide.

## Where things are

| To change…                         | Edit this file                                   |
| ---------------------------------- | ------------------------------------------------ |
| A page's words or pictures         | `content/<page-name>.md` (home is `index.md`)    |
| The menu, footer, address, phone   | [`content/site.yml`](content/site.yml)           |
| Add a picture                      | Upload it to `public/images/`                    |

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

## Layout blocks

The old site used Divi to arrange things side by side. Here that's done
with lines of colons. You mostly won't need to touch these; just edit the text
between them.

```markdown
::: details Question shown on the button
Answer that opens when clicked.
:::

::::: columns 3/4 1/4
:::: column
Left side (three quarters wide)
::::

:::: column
Right side (one quarter wide)
::::
:::::

:::::: band #d6efb0
Text on a full-width green stripe.
::::::
```

Blocks that sit inside other blocks need **more** colons on the outside:
questions and quotes use 3, a single column 4, a set of columns 5, and a
coloured stripe 6. If a page looks broken after an edit, a missing or
miscounted colon line is the usual cause.

A few buttons are written as HTML (`<a href="…" style="…">`). Change the words
and the link, and leave the rest alone.

## Previewing on your own computer (optional)

Needs [Node.js](https://nodejs.org/).

```bash
npm install
npm run dev
```

Then open http://localhost:5173. `npm run build` makes the finished site in `dist/`.

## How this was made

The pages were converted automatically from the WordPress database. A
word-by-word comparison with the live site found no differences on any of the
16 pages. The converter is in [`tools/convert.mjs`](tools/convert.mjs). It
isn't needed again unless the WordPress pages change before a switch.
