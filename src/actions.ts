import { App, Editor, MarkdownView, Modal, normalizePath, Notice, Plugin, PluginSettingTab, requestUrl, RequestUrlResponse, Setting, setIcon, TFolder, TFile } from 'obsidian';
import { PluginSettings } from './settings';

export function extractDocumentIdFromUrl(editor: Editor, settings: PluginSettings) {
	try {
		const selection = editor.getSelection();
		const documentId = selection.split('api/documents/')[1].split('/preview')[0];
		return documentId;
	} catch {
		return null;
	}
}

export async function getExistingShareLink(settings: PluginSettings, documentId: string) {
	const url = new URL(settings.paperlessUrl + '/api/documents/' + documentId + '/share_links/?format=json');
	let result;
	try {
		result = await requestUrl({
			url: url.toString(),
			headers: {
				'Authorization': 'token ' + settings.paperlessAuthToken
			}
		})
		if (result.status != 200) {
			console.error("An exception occurred in getExistingShareLink. Response: " + result);
			return null;
		}
		for (let item of result.json) {
			if (item['expiration'] == null)  {
				return new URL(settings.paperlessUrl + '/share/' + item['slug']);
			}
		}
	} catch (e) {
		console.error("An exception occurred in getExistingShareLink. Exception: " + e + " and response " + result);
	}

	return null;
}

export async function createShareLink(settings: PluginSettings, documentId: string) {
	const url = new URL(settings.paperlessUrl + '/api/share_links/');
	let result;
	try {
		result = await requestUrl({
			url: url.toString(),
			method: 'POST',
			contentType: 'application/json',
			body: '{"document":' + documentId + ',"file_version":"original"}',
			headers: {
				'Authorization': 'token ' + settings.paperlessAuthToken
			}
		})
		if (result.status != 201) {
			console.error("An exception occurred in createShareLink. Response: " + result);
		}
	} catch (e) {
		console.error("An exception occurred in createShareLink. Exception: " + e + " and response " + result);
	}
}

export async function getShareLink(settings: PluginSettings, documentId: string) {
	let link = await getExistingShareLink(settings, documentId);
	if (!link) {
		createShareLink(settings, documentId);
		link = await getExistingShareLink(settings, documentId);
		if (link == null) {
			// Sometimes this takes a while, give it five immediate retries before giving up.
			for (let i = 0; i < 5; i++) {
				link = await getExistingShareLink(settings, documentId);
				if (link) {
					break;
				}
			}
		}
	}

	return link;
}

// Heavily inspired by https://github.com/RyotaUshio/obsidian-pdf-plus/blob/127ea5b94bb8f8fa0d4c66bcd77b3809caa50b21/src/modals/external-pdf-modals.ts#L249
export async function createDocument(editor: Editor, settings: PluginSettings, documentId: string) {
	// Create the parent folder
	const folderPath = normalizePath(settings.documentStoragePath);
	if (folderPath) {
		const folderRef = this.app.vault.getAbstractFileByPath(folderPath);
		const folderExists = !!(folderRef) && folderRef instanceof TFolder;
		if (!folderExists) {
			await this.app.vault.createFolder(folderPath);
		}
	}
	
	const filename = 'paperless-' + documentId + '.pdf';
	const fileRef = this.app.vault.getAbstractFileByPath(folderPath + '/' + filename); 
	const fileExists = !!(fileRef) && fileRef instanceof TFile;
	if (!fileExists) {
		const shareLink = await getShareLink(settings, documentId);
		if (shareLink) {
			await this.app.vault.create(folderPath + '/' + filename, shareLink.href);
		}
	}

	editor.replaceSelection('![[' + filename + ']]');
}

export async function testConnection(settings: PluginSettings) {
	new Notice("Testing connection to " + settings.paperlessUrl)
	const url = new URL(settings.paperlessUrl + '/api/documents/');
	try {
		const result = await requestUrl({
			url: url.toString(),
			headers: {
				'Authorization': 'token ' + settings.paperlessAuthToken
			}
		})
		if (result.status == 200 && result.json['results']) {
			new Notice("Connection successful")
		}
	} catch(exception) {
		new Notice("Failed to connect to " + settings.paperlessUrl + " - check the console for additional information.")
		console.log("Failed connection to " + url + " with error: " + exception)
	}	
}
