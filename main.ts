import { App, Editor, MarkdownView, Modal, normalizePath, Notice, Plugin, PluginSettingTab, requestUrl, RequestUrlResponse, Setting } from 'obsidian';

interface PluginSettings {
	paperlessUrl: string;
	paperlessAuthToken: string;
	documentStoragePath: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
	paperlessUrl: '',
	paperlessAuthToken: '',
	documentStoragePath: ''
}

export default class ObsidianPaperless extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'insert-from-paperless',
			name: 'Insert document',
			editorCallback: (editor: Editor) => {
				new DocumentSelectorModal(this.app, editor, this.settings).open();
			}
		});

		this.addCommand({
			id: 'replace-with-paperless',
			name: 'Replace url with document',
			editorCallback: (editor: Editor) => {
				const documentId = extractDocumentIdFromUrl(editor, this.settings);
				if (documentId) {
					createDocument(editor, this.settings, documentId);
				}
			}
		});

		this.addCommand({
			id: 'force-refresh-cache',
			name: 'Refresh document cache',
			callback: () => {
				refreshCacheFromPaperless(this.settings);
			}
		});

		this.addSettingTab(new SettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

let cachedResult: RequestUrlResponse;

async function refreshCacheFromPaperless(settings: PluginSettings) {
	const url = new URL(settings.paperlessUrl + '/api/documents/?format=json');
	const result = await requestUrl({
		url: url.toString(),
		headers: {
			'Authorization': 'token ' + settings.paperlessAuthToken
		}
	})
	cachedResult = result;
}

function extractDocumentIdFromUrl(editor: Editor, settings: PluginSettings) {
	try {
		const selection = editor.getSelection();
		const documentId = selection.split('api/documents/')[1].split('/preview')[0];
		return documentId;
	} catch {
		return null;
	}
}

async function getExistingShareLink(settings: PluginSettings, documentId: string) {
	const url = new URL(settings.paperlessUrl + '/api/documents/' + documentId + '/share_links/?format=json');
	const result = await requestUrl({
		url: url.toString(),
		headers: {
			'Authorization': 'token ' + settings.paperlessAuthToken
		}
	})

	for (var item of result.json) {
		if (item['expiration'] == null)  {
			return new URL(settings.paperlessUrl + '/share/' + item['slug']);
		}
	}
	return null;
}

async function createShareLink(settings: PluginSettings, documentId: string) {
	const url = new URL(settings.paperlessUrl + '/api/share_links/');
	const result = await requestUrl({
		url: url.toString(),
		method: 'POST',
		contentType: 'application/json',
		body: '{"document":' + documentId + ',"file_version":"original"}',
		headers: {
			'Authorization': 'token ' + settings.paperlessAuthToken
		}
	})
}

async function getShareLink(settings: PluginSettings, documentId: string) {
	var link = await getExistingShareLink(settings, documentId);
	if (!link) {
		createShareLink(settings, documentId);
		link = await getExistingShareLink(settings, documentId);
		if (link == null) {
			// Sometimes this takes a while, give it three immediate retries before giving up.
			for (let i = 0; i < 3; i++) {
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
async function createDocument(editor: Editor, settings: PluginSettings, documentId: string) {
	// Create the parent folder
	const folderPath = normalizePath(settings.documentStoragePath);
	if (folderPath) {
		const folderExists = !!(this.app.vault.getAbstractFileByPath(folderPath));
		if (!folderExists) {
			await this.app.vault.createFolder(folderPath);
		}
	}
	
	const filename = 'paperless-' + documentId + '.pdf';
	const fileExists = !!(this.app.vault.getAbstractFileByPath(folderPath + '/' + filename));
	if (!fileExists) {
		const shareLink = await getShareLink(settings, documentId);
		if (shareLink) {
			await this.app.vault.create(folderPath + '/' + filename, shareLink.href);
		}
	}

	editor.replaceSelection('![[' + filename + ']]');
}

class DocumentSelectorModal extends Modal {
	editor: Editor;
	settings: PluginSettings;
	page: number;

	constructor(app: App, editor: Editor, settings: PluginSettings) {
		super(app);
		this.editor = editor;
		this.settings = settings;
		this.page = 0;
	}

	async displayThumbnail(imgElement: HTMLImageElement, documentId: string) {
		const thumbUrl = this.settings.paperlessUrl + '/api/documents/' + documentId + '/thumb/';
		const result = await requestUrl({
			url: thumbUrl.toString(),
			headers: {
				'Authorization': 'token ' + this.settings.paperlessAuthToken
			}
		})	
		imgElement.src = URL.createObjectURL(new Blob([result.arrayBuffer]));
	};

	async onOpen() {
		const {contentEl} = this;
		if (cachedResult == null) {
			await refreshCacheFromPaperless(this.settings);
		}

		const documentDiv = contentEl.createDiv({cls: 'row'});
		const left = documentDiv.createDiv({cls: 'column'});
		const right = documentDiv.createDiv({cls: 'column'});
		const bottomDiv = contentEl.createDiv();
		let observer = new IntersectionObserver(() => {
			const startIndex = this.page;
			let endIndex = this.page + 8;
			if (endIndex > cachedResult.json['all'].length) {
				endIndex = cachedResult.json['all'].length;
			}
			this.page = endIndex;
			for (let i = startIndex; i < endIndex; i++) {
				const documentId = cachedResult.json['all'][i];
				const imageDiv = ( i & 1 ) ? left.createDiv({cls: 'imageDiv'}) : right.createDiv({cls: 'imageDiv'});				;
				const imgElement = imageDiv.createEl('img');
				imgElement.width = 260;
				imgElement.onclick = () => createDocument(this.editor, this.settings, documentId);
				this.displayThumbnail(imgElement, documentId);
			}
		}, {threshold: [0.1]});
		observer.observe(bottomDiv);
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SettingTab extends PluginSettingTab {
	plugin: ObsidianPaperless;

	constructor(app: App, plugin: ObsidianPaperless) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
		.setName('Paperless URL')
		.setDesc('Full URL to your paperless instance.')
		.addText(text => text
			.setValue(this.plugin.settings.paperlessUrl)
			.onChange(async (value) => {
				this.plugin.settings.paperlessUrl = value;
				await this.plugin.saveSettings();
			}));
		new Setting(containerEl)
			.setName('Paperless authentication token')
			.setDesc('Token obtained using https://docs.paperless-ngx.com/api/#authorization')
			.addText(text => text
				.setValue(this.plugin.settings.paperlessAuthToken)
				.onChange(async (value) => {
					this.plugin.settings.paperlessAuthToken = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Document storage path')
			.setDesc('Location for stored documents.')
			.addText(text => text
				.setValue(this.plugin.settings.documentStoragePath)
				.onChange(async (value) => {
					this.plugin.settings.documentStoragePath = value;
					await this.plugin.saveSettings();
				}));
	}
}
