# Official Ulanzi store submission — email draft

**To:** ustudioservice@ulanzi.com
**Subject:** Plugin submission: Claude Deck — AI coding-agent control surface for D200X

---

Hello Ulanzi Studio team,

I'd like to submit **Claude Deck**, a free open-source plugin for the D200X
(UlanziDeck), for consideration in the official plugin store.

**What it does:** Claude Deck turns the D200X into a control surface for Claude
Code (Anthropic's AI coding agent) — comparable to OpenAI's Codex Micro device,
but on Ulanzi hardware:

- One key per live AI session, color-coded like status lights (blue working,
  amber needs attention, green unread result, red error); press to switch
- Contextual approve/deny keys that light up when the agent asks permission
- Plan review on an encoder (rotate through the AI's plan steps, press to approve)
- Live tiles: model, context gauge, session cost, token counter, trend sparklines
- A command-palette encoder and reasoning-effort dial
- The deck automatically follows whichever terminal tab the user is working in

**Details:**
- Built with the official UlanziDeckPlugin-SDK (Node mode), manifest v1.0.0
- UUID: com.ulanzi.ulanzideck.claudedeck *(happy to re-namespace to our own
  vendor id if required)*
- macOS 12+; MIT licensed
- Source: https://github.com/peersclub/ulanzi-extensions
- Packaged release: https://github.com/peersclub/ulanzi-extensions/releases/tag/v1.0.0
  (asset: com.ulanzi.ulanzideck.claudedeck.ulanziPlugin.zip — self-contained,
  bundles its data adapter with a one-command installer)

Could you let me know the requirements/process for listing it in the official
store (and the UGC portal at ugc.ulanzistudio.com if that's the right channel)?
I'm glad to make any changes needed to meet your review guidelines.

Thanks — and thanks for publishing the SDK.

Best regards,
Victor
https://github.com/peersclub/ulanzi-extensions
