# AI Assistant

The **AI Assistant** (ArchTech AI) is a conversational helper available inside the Software SRS/SDD workspace. Use it to ask questions about your project, requirements or SRS document, to generate or revise content, and to apply edits directly to the open document — always under your control.

## Opening the Assistant

In the workspace header, click the **ASSISTANT** button in the top-right corner. A panel opens with the greeting message:

> Hi! I'm your AI assistant. Ask me anything about your project, requirements, or SRS document.

![Assistant button in the workspace header with the assistant panel open](/guides/images/6_1_ai_assistant_menu.png)

The panel header shows the conversation name and message count. The copy icon lets you copy the current conversation, and the ✕ icon closes the panel.

## Choosing a Model

Open the panel options menu to pick which model the assistant uses. The **MODEL** section lists the available models — for example `claude-haiku-4-5`, `claude-opus-4-6` and `claude-sonnet-4-6` — with a check mark on the active one.

![Model selection list with claude-opus-4-6 checked](/guides/images/6_2_ai_assistant_model_select_option.png)

> [!NOTE]
> The model choice applies to new messages. Switch models at any time — for fast questions use the lighter model, for complex reasoning use the heavier one.

## Adding Context

In the same options menu, the **CONTEXT** field lets you mention files from the project with `@`. Mentioned files are attached to the conversation so the assistant can read them when answering.

## Sending a Message

1. Type your question or instruction into the **Ask AI Assistant…** input at the bottom of the panel.
2. Press the send button (↑) on the right of the input.

### Attaching Selected Blocks

If you selected one or more content blocks in the document editor (see [Document Generation](/guide?page=document-generation)), they appear as chips next to the input. The assistant then focuses its answer on exactly those blocks — ideal for asking for a rewrite of a single paragraph.

### Ask Before Edits

Below the input, the **Ask before edits** toggle controls how the assistant applies changes:

- **Enabled** — the assistant proposes an edit and waits for your confirmation before writing to the document.
- **Disabled** — the assistant applies edits immediately.

Use the icon button on the left of the input to toggle edit mode.

![Edit-mode toggle next to Ask before edits](/guides/images/6_3_ai_assistant_input_menu.png)

> [!IMPORTANT]
> Keep **Ask before edits** enabled while you are still shaping a section. Turn it off only when you trust the assistant to apply routine changes on its own.

## Clearing the Conversation

To start over, open the options menu and click **Clear conversation**. All messages are removed and the panel returns to the greeting state.

![Clear conversation option highlighted in the options menu](/guides/images/6_4_ai_assistant_clear_option.png)

> [!NOTE]
> Clearing the conversation does not change your documents — it only resets the chat history and its context.

## Next Steps

Continue to [Version Management](/guide?page=version-management) to keep track of every generated and revised document version.
