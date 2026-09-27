# LLM Configuration

The **LLM Configuration** panel holds the global API settings for your project. Before you can extract data, analyse templates or generate documents, you must connect the application to a language-model endpoint and choose a default model. The settings you save here apply to every workspace in the current project.

## Opening the Configuration Dialog

The configuration dialog opens from the settings entry point in the workspace. When opened for the first time, all fields are empty.

![LLM Configuration dialog with empty fields](/guides/images/1_LLM_config_empty.png)

The dialog is split into two areas:

- **API Connection** — the endpoint URL and the secret API key.
- **Default Model** — the model used for all generation tasks.

## Configuring the API Connection

### API URL

Enter the base URL of your LLM gateway in the **API URL** field, for example:

```
https://llmgw.datapatterns.co.in
```

> [!IMPORTANT]
> Do not include a trailing path such as `/v1` unless your provider requires it. The application appends the correct route automatically.

### API Key

Enter the secret key issued by your provider into the **API Key** field.

![API Key field highlighted](/guides/images/1_LLM_config_empty_api_key.png)

- Keys are displayed masked. Use the eye icon on the right of the field to reveal the value while typing.
- The key is stored per project and is never shown in full after saving.

> [!WARNING]
> Without a valid API URL **and** API key, every generation feature will fail with a connection error. Double-check both values before saving.

## Selecting the Default Model

Once the connection details are filled in, choose the model that will be used by default for extraction, analysis and generation.

![Default model selection with three available models](/guides/images/1_LLM_config_model_select.png)

Available models in this example:

- `claude-haiku-4-5` — fastest, suited to lightweight tasks.
- `claude-opus-4-6` — most capable, suited to complex reasoning.
- `claude-sonnet-4-6` — balanced, marked as **DEFAULT**.

Select the radio button next to the model you want. The currently selected model is highlighted and labelled.

> [!NOTE]
> The default model can be changed at any time by reopening this dialog. Workspaces pick up the new model on their next generation run.

## Saving and Closing

- Click **SAVE** to persist the connection settings and default model. A confirmation appears when the settings are stored.
- Click **CLOSE** to dismiss the dialog without applying changes.

## Next Steps

With the LLM configured, continue to [Data Extraction](/guide?page=data-extraction) to bring your source documents into the project.
