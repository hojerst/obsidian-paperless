# Obsidian ❤️ Paperless-ngx

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
5. Click "Test connection" to confirm connectivity. If any errors appear, you can view them in the console. Open the console using `cmd+option+i` (MacOS) or `ctrl+shift+i` (Windows). 

## Usage

### Basic usage
1. Go to the note you want to insert a document into. The editor view must be in focus.
1. Open the command palette in Obsidian (ctrl/cmd + p or swipe down on mobile).
1. Search "Paperless".
1. Select `Paperless: Insert document`. Click on the document(s) you want to insert.

### Available Commands
The following commands are available for use.

#### Insert document
The standard insertion command. Please note you must have an open editor focused to use this command. Brings up the document selection modal.

#### Refresh document cache
The "Insert document" command caches some information such as available documents, tags, and other metadata when it is first run. If you find that new documents or changes are not showing up in the document selection modal, running this command will refresh the caches.

#### Replace URL with document
This command replaces a highlighted url in a note with an embed of the document. To use:
1. Highlight a paperless url in a note. The url should be of the form `http://ip:port/api/documents/id/preview/`
1. Run this command