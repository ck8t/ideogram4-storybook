# Ideogram 4 Storybook — CK8T Test Cases

---

## Test 1.1 — Block Manager: Install ideogram4-storybook

### Test A: Install from ZIP

**Do this:**
1. Open CK8T in VS Code
2. Go to **Block Manager** tab (sidebar or top nav)
3. Click the **Install** tab
4. In the ZIP section, click **Choose .zip file** or drag-drop a zip of `/Users/salilvnair/workspace/git/ck8t/ideogram4-storybook/` onto the drop zone
5. Wait for the install to complete

**Should happen:**
- Progress indicator appears during install
- Success bar appears: "Ideogram 4 Storybook installed successfully"
- A **Restart now** button appears in the success bar
- The **Installed** tab now shows an "Ideogram 4 Storybook" card with version `1.0.0`

---

### Test B: Install from GitHub URL

**Do this:**
1. Go to Block Manager → Install tab → GitHub section
2. Enter the GitHub URL for the ideogram4-storybook repo
3. Click **Install from GitHub**

**Should happen:**
- Install progress shown
- On success, "Ideogram 4 Storybook" appears in the Installed tab
- Card shows: author `salilvnair`, version `1.0.0`, blocks: `story_splitter`, `storybook_pdf`

---

### Test C: Installed tab shows block details

**Do this:**
1. Go to Block Manager → **Installed** tab
2. Click on the **Ideogram 4 Storybook** card to expand it

**Should happen:**
- Block list shows two entries: `story_splitter` and `storybook_pdf`
- Each has its type name, description, and category
- An **Uninstall** button is visible
- No error banner at the top (previously showed `Cannot GET /api/v1/block-manager/blocks`)

---

### Test D: Restart after install

**Do this:**
1. After install completes, click the **Restart now** button in the success bar

**Should happen:**
- VS Code reloads the window
- CK8T reopens and the block is still listed in Installed tab
- No re-install required after restart

---

## Test 1.2 — MCP Server Setup: ideogram4

### Test A: Add the ideogram4 MCP server

**Do this:**
1. Open CK8T → Settings → MCP Servers
2. Click **Add server**
3. Fill in:
   - **Name**: `ideogram4`
   - **Transport**: `stdio`
   - **Command**: `/opt/homebrew/anaconda3/envs/id4/bin/python`
   - **Arguments** (one per line):
     ```
     /Users/salilvnair/workspace/experiments/mflux-id4/ideogram4_mcp_server.py
     ```
   - **Environment** (one per line): `ANTHROPIC_API_KEY=<your key>`
4. Click **Save**

**Should happen:**
- Server appears in the MCP Servers list with name `ideogram4`
- Status dot shows grey (not yet probed) — not red
- No "server not found" error

---

### Test B: MCP server tools are discoverable

**Do this:**
1. In Settings → MCP Servers, click **Tools** next to the `ideogram4` row

**Should happen:**
- Status dot turns green
- Three tool chips appear: `magic_prompt`, `generate_image`, `list_images`
- Each chip shows a truncated description on the same line
- Hovering a chip shows the full description in a tooltip
- No connection error

---

## Test 2.1 — Workflow Import

### Test A: Import the sample workflow

**Do this:**
1. Open CK8T canvas
2. Click **Import** (top bar or File menu)
3. Select `/Users/salilvnair/workspace/git/ck8t/ideogram4-storybook/sample/workflow.json`

**Should happen:**
- Canvas loads the workflow named "Storybook · Crow, Cat & Dog → PDF + Cover Image"
- 11 nodes appear on the canvas in a linear-then-branch layout:
  - **Main trunk**: Start → Story Text → Speech Bubble Agent → Scene Splitter
  - **Top branch (PDF)**: Scene Splitter → Storybook PDF → PDF Preview
  - **Bottom branch (image)**: Scene Splitter → Cover Prompt Agent → Magic Prompt → Wrap Caption → Generate Image → Cover Image
- All edges are animated (blue flowing lines)
- No error toasts

---

### Test B: Node types resolved correctly

**Do this:**
1. After import, click each node and check its block type in the inspector panel

**Should happen:**
- `n_starter` → type: `starter` (green)
- `n_story_input` → type: `user_input` (yellow)
- `n_speech_agent` → type: `agent` (indigo)
- `n_splitter` → type: `story_splitter` (purple)
- `n_storybook_pdf` → type: `storybook_pdf` (red)
- `n_scene_agent` → type: `agent` (indigo)
- `n_magic_prompt` → type: `mcp` (dark)
- `n_fn_wrap` → type: `function` (sky blue)
- `n_gen_image` → type: `mcp` (dark)
- `n_pdf_preview` and `n_image_preview` → type: `show_preview` (teal)

---

### Test C: subBlockValues pre-filled

**Do this:**
1. Click the **Story Text** node

**Should happen:**
- The default value field contains the full Kauwa/Billi/Kutta story (5 scenes with `[CROW_SAYS: ...]` placeholders)
- Placeholder text: "Paste your story here…"

**Do this:**
2. Click the **Speech Bubble Agent** node

**Should happen:**
- Model: `gpt-4.1`
- System prompt describes Kauwa, Billi, Kutta voice rules and Indian 90s era constraints
- Temperature: `0.8`

**Do this:**
3. Click the **Scene Splitter** node

**Should happen:**
- Split by: `scene (## heading)`
- Include heading: OFF
- Max scenes: `8`

**Do this:**
4. Click the **Storybook PDF** node

**Should happen:**
- Title: `Kauwa, Billi aur Kutta — An Indian 90s Tale`
- Author: `salilvnair`
- Page size: `A4`
- Layout: `Title page + scenes`
- Include page numbers: ON

**Do this:**
5. Click the **Magic Prompt** MCP node

**Should happen:**
- Server: `ideogram4`
- Tool: `magic_prompt`

**Do this:**
6. Click the **Generate Image** MCP node

**Should happen:**
- Server: `ideogram4`
- Tool: `generate_image`

---

## Test 3.1 — Story Splitter Block

### Test A: Split by scene heading

**Do this:**
1. On the canvas, click the **Story Text** (user_input) node
2. Verify the default value field already contains (or paste) this story:

```
## Scene 1: The Empty Roof

It was the summer of 1994, the kind that made tar roads soft and dogs move slowly. On the crumbling terrace of Shivam Bhavan in Pune, Kauwa the crow sat very still, watching the street below.

[CROW_SAYS: ...]

## Scene 2: The Clever Cat

Billi was asleep on the warm ledge beneath the water tank, her striped tail curled around her like a coiled telephone cord.

[CAT_SAYS: ...]

## Scene 3: The Dog Who Smelled Everything

Kutta had been sitting behind the neem tree at the gate of Shivam Bhavan since early morning.

[DOG_SAYS: ...]
```

3. Click the **Scene Splitter** node → click **Run node** (or run the workflow up to this node)

**Should happen:**
- Output `scenes` = array of 3 objects:
  ```json
  [
    { "index": 1, "title": "Scene 1: The Empty Roof", "content": "It was the summer of 1994..." },
    { "index": 2, "title": "Scene 2: The Clever Cat", "content": "Billi was asleep..." },
    { "index": 3, "title": "Scene 3: The Dog Who Smelled Everything", "content": "Kutta had been sitting..." }
  ]
  ```
- Output `count` = `3`
- Output `first` = the first scene object (Scene 1)
- Output `last` = the third scene object (Scene 3)

---

### Test B: Max scenes limit respected

**Do this:**
1. Click the **Scene Splitter** node
2. Set **Max scenes** to `2`
3. Re-run with the 5-scene crow/cat/dog story

**Should happen:**
- `count` = `2`
- `scenes` array has only Scene 1 and Scene 2
- Scenes 3–5 are NOT in the output

---

### Test C: Split by paragraph fallback

**Do this:**
1. Change **Split by** to `Paragraph (blank line)`
2. Use input text with no `##` headings, only blank-line-separated paragraphs

**Should happen:**
- Scenes are split at each blank line
- Each scene title auto-assigned as `Scene 1`, `Scene 2`, etc.

---

### Test D: Empty input handled gracefully

**Do this:**
1. Pass an empty string as input to the Story Splitter

**Should happen:**
- `scenes` = `[]`
- `count` = `0`
- `first` = `null`
- `last` = `null`
- No crash or error thrown

---

## Test 3.2 — Speech Bubble Agent

### Test A: Agent receives story text and fills placeholders

**Do this:**
1. Paste the full 5-scene Kauwa/Billi/Kutta story (with `[CROW_SAYS: ...]` markers) into the Story Text node
2. Run the **Speech Bubble Agent** node alone (or run the workflow up to this node)

**Should happen:**
- Agent receives the raw story text as input
- Returns the complete story with every `[CROW_SAYS: ...]`, `[CAT_SAYS: ...]`, `[DOG_SAYS: ...]` replaced by actual dialogue
- Example output for Scene 1:
  ```
  [CROW_SAYS: 'Ek dum perfect. Aaj toh mera din hai.']
  ```
- Kauwa's lines mix Hindi phrases (clever, a little dramatic)
- Billi's lines are short and dry (one sentence max)
- Kutta's lines are warm and enthusiastic
- No placeholder marker is left unfilled
- All `##` scene headings and prose text are unchanged

---

### Test B: Dialogue respects Indian 90s era

**Do this:**
1. Read the filled dialogue output from Test A
2. Check character lines for era authenticity

**Should happen:**
- No mobile phone references
- No internet/WhatsApp references
- May reference Doordarshan, Maruti 800, vada pav, Chitrahaar, cycle-rickshaw, peepal tree, cable TV
- Tone matches a children's picture book — warm, playful, age-appropriate

---

### Test C: Filled story passes through to Scene Splitter

**Do this:**
1. Let the Speech Bubble Agent complete
2. Check the Scene Splitter's input (the `data` output from the agent)

**Should happen:**
- Scene Splitter receives the filled story text (not the raw placeholder version)
- All `##` headings are intact
- Scene Splitter correctly splits into 5 scenes
- Speech bubbles appear inside each scene's `content` field

---

### Test D: Agent with no model configured — clear error

**Do this:**
1. Clear the model field on the **Speech Bubble Agent** node
2. Attempt to run the workflow

**Should happen:**
- Workflow stops at `n_speech_agent`
- Error shown: `No model provider configured for "Speech Bubble Agent"`
- No crash, error displayed inline on the canvas node

---

## Test 3.3 — Cover Prompt Agent

### Test A: Agent receives first scene and returns JSON

**Do this:**
1. Ensure the full workflow runs through Speech Bubble Agent → Scene Splitter
2. Let the **Cover Prompt Agent** run on the `first` scene output

**Should happen:**
- Agent receives `{ index: 1, title: "Scene 1: The Empty Roof", content: "...filled story content..." }`
- Template `{{title}}` and `{{content}}` are interpolated in the userPrompt
- Agent returns valid JSON:
  ```json
  { "prompt": "...", "aspect_ratio": "16:9" }
  ```
- `prompt` describes the scene in Indian 90s children's book illustration style
- `aspect_ratio` is `"16:9"` or `"1:1"`

---

### Test B: No model configured — clear error

**Do this:**
1. Clear the model field on the **Cover Prompt Agent** node
2. Attempt to run the workflow

**Should happen:**
- Workflow stops at this node
- Error shown: `No model provider configured for "Cover Prompt Agent"`
- No crash, error displayed inline on the canvas node

---

## Test 3.4 — MCP: magic_prompt Tool

### Test A: magic_prompt converts prompt to Ideogram JSON

**Do this:**
1. With a valid agent output `{ "prompt": "A clever crow on a Pune rooftop in 1994, warm afternoon light, Indian children's book illustration, vada pav on windowsill, neem tree below", "aspect_ratio": "16:9" }`, run the **Magic Prompt** MCP node

**Should happen:**
- `magic_prompt` is called with args `{ prompt: "...", aspect_ratio: "16:9" }`
- Node output: `{ content: [{ type: "text", text: "<JSON string>" }], isError: false }`
- The `text` value is a valid JSON caption string in Ideogram 4 format
- No error from the MCP server

---

### Test B: MCP server not running — clear error

**Do this:**
1. Stop the ideogram4 MCP server process
2. Attempt to run the Magic Prompt node

**Should happen:**
- Error appears: `MCP server "ideogram4" not found` or connection refused message
- Workflow stops at this node
- No silent failure or empty output

---

## Test 3.5 — Function Block: Wrap Caption

### Test A: Unwraps MCP content array correctly

**Do this:**
1. Run the **Wrap Caption** function node with input `[{ "type": "text", "text": "{\"high_level_description\":\"...\"}" }]`

**Should happen:**
- Output: `{ caption_json: "{\"high_level_description\":\"...\"}" }`
- The `text` field is extracted from the first content item
- Result is an object (not a string) suitable for passing to `generate_image`

---

### Test B: Handles non-array input gracefully

**Do this:**
1. Pass a plain string `"some caption text"` as input to the Wrap Caption node

**Should happen:**
- Output: `{ caption_json: "some caption text" }`
- No crash
- `generate_image` can still receive the caption

---

## Test 3.6 — MCP: generate_image Tool

### Test A: generate_image produces a PNG

**Do this:**
1. With a valid `{ caption_json: "<Ideogram JSON string>" }` input, run the **Generate Image** MCP node
2. Wait (image generation takes 20–90 seconds on Apple Silicon)

**Should happen:**
- Node output: `{ content: [{ type: "text", text: "Generated in Xs\n...![generated image](data:image/png;base64,...)" }], isError: false }`
- The text includes a `data:image/png;base64,` embedded image
- A file `id4_<timestamp>.png` is saved in `/Users/salilvnair/workspace/experiments/mflux-id4/outputs/`
- No Python error or model loading error

---

### Test B: Preview node shows the image

**Do this:**
1. Let the full bottom branch run through to **Cover Image** (`show_preview` node)
2. Check the Preview panel in CK8T

**Should happen:**
- The preview panel renders the Markdown output from `generate_image`
- The embedded base64 PNG is displayed as an inline image
- Image dimensions match the requested size (default 1024×1024)
- The image should show the Pune rooftop / crow scene in Indian 90s illustration style

---

## Test 3.7 — Storybook PDF Block

### Test A: PDF generated from scenes array

**Do this:**
1. Ensure Scene Splitter produces a valid `scenes` array (at least 2 scenes, with filled speech bubbles)
2. Run the **Storybook PDF** node

**Should happen:**
- Node receives the `scenes` array via the `scenes` → `in_input` edge
- Output `pdf_base64` is a non-empty base64 string
- Output `pages` ≥ 2 (title page + scene pages)
- Output `size_bytes` > 0
- Output `path` is empty (since `output_path` is blank)

---

### Test B: PDF preview shows base64 content

**Do this:**
1. Run the full top branch through to **PDF Preview** node

**Should happen:**
- Preview panel shows the `pdf_base64` string (or a rendered PDF if CK8T supports it)
- No "storybook_pdf requires VS Code extension" error (extension is connected)

---

### Test C: PDF requires VS Code extension — error in client mode

**Do this:**
1. Run the workflow in client-only mode (no extension connected, no ck8t-server)

**Should happen:**
- Storybook PDF node throws: `Storybook PDF requires the CK8T VS Code extension (pdf-lib runs in Node.js). Connect the extension to generate the PDF.`
- Error displayed on the node in the canvas
- Other nodes unaffected

---

### Test D: Custom output path saves file to disk

**Do this:**
1. Click the **Storybook PDF** node
2. Set **Save to path** to `~/Desktop/kauwa-billi-kutta.pdf`
3. Re-run the node

**Should happen:**
- A file `kauwa-billi-kutta.pdf` appears on the Desktop
- Output `path` = full absolute path to the file
- Output `pdf_base64` is empty (file was written to disk instead)

---

### Test E: Title page and speech bubbles appear correctly in PDF

**Do this:**
1. Run the full workflow with the default 5-scene story and a valid LLM provider
2. Open the resulting PDF

**Should happen:**
- First page: title `Kauwa, Billi aur Kutta — An Indian 90s Tale` centered, author `salilvnair` below
- Scene pages: each scene on its own page with scene title as heading, prose as body text
- Filled speech bubbles appear as `[CROW_SAYS: 'actual dialogue']` inline in the scene text
- Page numbers at the bottom of each page
- No placeholder markers (`[CROW_SAYS: ...]`) remain unfilled

---

## Test 4.1 — End-to-End Run

### Test A: Full workflow run with the 5-scene story

**Do this:**
1. Open the imported workflow on the canvas
2. Click the **Story Text** node — confirm the default value contains the Kauwa/Billi/Kutta story with 5 `##` scene headings
3. Click **Start** (Starter node or run button)
4. Wait for the complete run (speech bubble fill ~5s, image generation 30–90s)

**Should happen:**
- **Speech Bubble Agent** completes first, returning the filled story text
- **Scene Splitter** splits into 5 scenes
- **Top branch** (no image generation — faster):
  - Storybook PDF produces a base64 PDF with 6 pages (title + 5 scenes)
  - PDF Preview node shows the output
- **Bottom branch** (runs in parallel, completes after image):
  - Cover Prompt Agent receives Scene 1 ("The Empty Roof") and writes an Indian 90s illustration prompt
  - `magic_prompt` converts it to Ideogram JSON
  - Wrap Caption extracts and wraps the caption
  - `generate_image` produces a 1024×1024 PNG showing Kauwa on the Pune rooftop
  - Cover Image preview shows the generated image inline
- No node shows a red error state
- Run trace shows all 11 nodes executed

---

### Test B: Partial run — top branch only (no MCP)

**Do this:**
1. **Disable** the `n_scene_agent`, `n_magic_prompt`, `n_fn_wrap`, `n_gen_image`, and `n_image_preview` nodes
2. Run the workflow

**Should happen:**
- Speech Bubble Agent fills placeholders
- Scene Splitter splits into 5 scenes
- Storybook PDF generates the PDF successfully
- No error from the disabled MCP nodes
- Re-enable nodes after test

---

### Test C: Scene count matches story

**Do this:**
1. Use the full default story (5 `##` scene headings) and run up to the Scene Splitter

**Should happen:**
- `count` = `5`
- Scene titles (from `## Scene X: Title` headings):
  1. `Scene 1: The Empty Roof`
  2. `Scene 2: The Clever Cat`
  3. `Scene 3: The Dog Who Smelled Everything`
  4. `Scene 4: The Meeting Under the Peepal Tree`
  5. `Scene 5: The Feast`
- `first.title` = `"Scene 1: The Empty Roof"`
- `last.title` = `"Scene 5: The Feast"`

---

## Test 5.1 — Custom Provider Settings

### Test A: DeepSeek provider auto-populates URLs

**Do this:**
1. Open CK8T → Settings → Custom LLM Providers
2. Click **Add Provider**
3. In the **Type** dropdown, select `DeepSeek`

**Should happen:**
- **Host** field auto-populates with `https://api.deepseek.com`
- **Chat URL** auto-populates with `https://api.deepseek.com/v1/chat/completions`
- **Models URL** auto-populates with `https://api.deepseek.com/v1/models`
- No "Unknown provider type: deepseek" error
- Fields are editable (not locked)

---

### Test B: Switching provider type swaps URLs intelligently

**Do this:**
1. Add a provider, select type `DeepSeek` (URLs auto-filled)
2. Change type dropdown to `Mistral`

**Should happen:**
- Host changes from `https://api.deepseek.com` → `https://api.mistral.ai`
- Chat URL and Models URL update to Mistral's defaults
- If you had already typed a custom URL, it is NOT overwritten

---

### Test C: Saving DeepSeek provider succeeds

**Do this:**
1. Add a provider: Name=`DeepSeek`, Type=`deepseek`, add your API key
2. Click **Save**

**Should happen:**
- No "Unknown provider type: deepseek" error
- Provider appears in the custom providers list
- Clicking **Fetch Models** returns a list of available DeepSeek models

---

### Test D: All OpenAI-compatible types save without error

**Do this:**
1. Repeat Test C for each of: `grok`, `mistral`, `gemini`, `qwen`

**Should happen:**
- All save successfully
- None throw "Unknown provider type: X"
- Fetch Models returns results for each (requires valid API keys)

---

## Test 5.2 — Block Runner: story_splitter in All Environments

### Test A: story_splitter runs in client (browser)

**Do this:**
1. Run the workflow in CK8T web app (browser, no extension, no server)
2. Trigger the Scene Splitter node

**Should happen:**
- Scene Splitter executes using the client runner
- Scenes are split correctly
- No "requires Node.js" error

---

### Test B: story_splitter runs on ck8t-server

**Do this:**
1. Start `ck8t-server` and point CK8T at it
2. Run the workflow

**Should happen:**
- Scene Splitter executes using the server runner
- Same output as client run
- No difference in scene count or content

---

### Test C: storybook_pdf throws in client mode (expected)

**Do this:**
1. Run the workflow in browser-only mode (no extension)
2. Allow the Storybook PDF node to execute

**Should happen:**
- Error: `Storybook PDF requires the CK8T VS Code extension (pdf-lib runs in Node.js). Connect the extension to generate the PDF.`
- This is expected behaviour documented in the block
- story_splitter and speech bubble agent complete successfully before this error

---

## Test 6.1 — Edge Cases

### Test A: Story with no ## headings

**Do this:**
1. Paste text with no `##` headings into Story Text (just plain paragraphs)
2. Keep Split by = `scene (## heading)`
3. Run

**Should happen:**
- Speech Bubble Agent runs but has no dialogue placeholders to fill (returns text unchanged)
- Scene Splitter output: `scenes` = `[]`, `count` = `0`, `first` = `null`
- Storybook PDF receives an empty array and outputs an empty PDF or throws a graceful error
- Cover Prompt Agent receives `null` input and either skips or shows a clear error

---

### Test B: Story with unfillable placeholders (no character match)

**Do this:**
1. Use a story that has `[NARRATOR_SAYS: ...]` (a marker the agent doesn't know about)
2. Run the Speech Bubble Agent

**Should happen:**
- Agent fills markers it recognises (`CROW_SAYS`, `CAT_SAYS`, `DOG_SAYS`)
- Unknown markers are either filled with a generic response or left as-is (acceptable either way)
- No crash

---

### Test C: Very long story (> 8 scenes)

**Do this:**
1. Paste a story with 12 `##` scene headings
2. Set Max scenes = `8` on the Scene Splitter
3. Run

**Should happen:**
- Speech Bubble Agent fills all 12 scenes' placeholders (it runs before the splitter)
- Scene Splitter respects the max: `count` = `8`, scenes 9–12 are not included
- Storybook PDF generates 9 pages (title + 8 scenes)

---

### Test D: Agent returns non-JSON for Cover Prompt (wrong format)

**Do this:**
1. Temporarily remove the `responseFormat` from the **Cover Prompt Agent** node
2. Run the workflow

**Should happen:**
- Agent returns plain text instead of JSON
- Magic Prompt MCP node receives the plain text string
- `magic_prompt` is called with `args = {}` (JSON.parse fails on plain text)
- Error appears on the Magic Prompt node (not a crash)

---

### Test E: Workflow JSON exported matches expected structure

**Do this:**
1. Open the imported workflow on the canvas
2. Click **Export** → save to a file
3. Open the exported JSON and verify structure

**Should happen:**
- `workflow.id` = `wf_storybook_pdf_cover`
- `workflow.name` = `"Storybook · Crow, Cat & Dog → PDF + Cover Image"`
- `workflow.nodes` has exactly 11 items
- `workflow.edges` has exactly 10 items
- `subBlockValues.n_speech_agent.model` = `"gpt-4.1"`
- `subBlockValues.n_splitter.split_by` = `"scene"`
- `subBlockValues.n_storybook_pdf.title` = `"Kauwa, Billi aur Kutta — An Indian 90s Tale"`
- `subBlockValues.n_magic_prompt.server` = `"ideogram4"`
- `subBlockValues.n_gen_image.tool` = `"generate_image"`
