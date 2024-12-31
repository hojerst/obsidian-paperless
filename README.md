# Obsidian ❤️ Paperless-ngx

⚠️ Under construction - this plugin is not ready for any public consumption ⚠️

This plugin allows users to easily insert PDFs from their self-hosted paperless-ngx instance into their Obsidian notes.

## Features

- View all documents on your paperless-ngx instance from within the comfort of your Obsidian vault.
- One-click insertion of one or many documents into your vault.

## Prerequisites 
This assumes you have a working version of [paperless-ngx](https://github.com/paperless-ngx/paperless-ngx) hosted. It does not necessarily need to be remotely accessible. This decision is left up to the reader. 

You must also have the ✨amazing✨ [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus) plugin installed!

## How it works
This plugin interacts with your paperless instance to enable seamless viewing of your documents within Obsidian. When you click on a document to import it will generate a share link from paperless and embed it into a *external PDF file*. Read more [here](https://ryotaushio.github.io/obsidian-pdf-plus/external-pdf-files.html). You can now view that document as though it was natively loaded in your vault, without needing to worry about local or remote storage limits.

## Setup

**Paperless-ngx**

1. Obtain an authorization token for your account. Open the "My Profile" link in the user dropdown found in the paperless-ngx web UI. Copy the API Auth Token.


**Obsidian**

2. Install the plugin.
3. Install [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus).
4. Fill in the following settings:
    - Paperless URL: full url to your paperless-ngx instance. Do not include the trailing `/`.
    - Paperless authentication token: token you obtained in step 1.
    - Document storage path: location you would like to save references to these PDFs.