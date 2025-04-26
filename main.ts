import { App, Editor, EditorRange, MarkdownView, Modal, normalizePath, Notice, Plugin, PluginSettingTab, requestUrl, RequestUrlResponse, Setting, setIcon, TFolder, TFile } from 'obsidian';
import { escapeRegExp } from 'lodash';

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
			name: 'Replace URL with document',
			editorCallback: (editor: Editor) => {
				const paperlessUrl = parsePaperlessUrlAtCursor(editor, this.settings);
				if (paperlessUrl) {
					createDocument(editor, this.settings, paperlessUrl);
				}
			}
		});

		this.addCommand({
			id: 'force-refresh-cache',
			name: 'Refresh document cache',
			callback: () => {
				new Notice('Refreshing paperless cache.');
				refreshCacheFromPaperless(this.settings, false);
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
let tagCache = new Map();

async function testConnection(settings: PluginSettings) {
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

async function refreshCacheFromPaperless(settings: PluginSettings, silent=true) {
	const url = new URL(settings.paperlessUrl + '/api/documents/?format=json');
	const result = await requestUrl({
		url: url.toString(),
		headers: {
			'Authorization': 'token ' + settings.paperlessAuthToken
		}
	})
	cachedResult = result;

	// Cache data relating to tags
	const tagUrl = new URL(settings.paperlessUrl + '/api/tags/?format=json');
	const tagResult = await requestUrl({
		url: tagUrl.toString(),
		headers: {
			"accept": "application/json; version=5",
			'Authorization': 'token ' + settings.paperlessAuthToken
		}
	})
	for (let i = 0; i < tagResult.json['results'].length; i++) {
		let current = tagResult.json['results'][i];
		tagCache.set(current['id'], current);
	}
	if(!silent) {
		new Notice('Paperless cache refresh completed. Found ' + cachedResult.json['all'].length + ' documents and ' + tagCache.size + ' tags.');
	}
}

/// Find the word under the cursor (we can't use editor.wordAt because we want everything between two whitespace characters)
function wordAtCursor(editor: Editor): EditorRange | null {
	const cursor = editor.getCursor();
	const line = editor.getLine(cursor.line);

	const wordRegex = /\S+/g;
	let match: RegExpExecArray | null;

	while ((match = wordRegex.exec(line)) !== null) {
		const start = match.index;
		const end = start + match[0].length;
		if (cursor.ch >= start && cursor.ch <= end) {
			return {
				from: { line: cursor.line, ch: start },
				to: { line: cursor.line, ch: end }
			};
		}
	}

	return null;
}

interface PaperlessUrl {
	documentId: string;
	range: EditorRange;
}

/// Parse the Paperless URL from the cursor position
function parsePaperlessUrlAtCursor(editor: Editor, settings: PluginSettings): PaperlessUrl | null {
	try {
		const wordRange = wordAtCursor(editor);
		if (wordRange === null) {
			return null;
		}

		const text = editor.getRange(wordRange.from, wordRange.to)

		// find documentId in the selection using a regex
		const normalizedUrl = new URL(settings.paperlessUrl);
		const quotedUrl = escapeRegExp(normalizedUrl);
		const regex = quotedUrl +
			"(?:" +
			"api/documents/(?<documentId>\\d+)/preview" +
			"|documents/(?<documentId>\\d+)/details" +
			")";

		const match = text.match(regex);
		if (!match || !match.groups) {
			return null;
		}

		return {
			documentId: match.groups.documentId,
			range: wordRange
		};
	} catch {
		return null;
	}
}

async function getExistingShareLink(settings: PluginSettings, documentId: string) {
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

async function createShareLink(settings: PluginSettings, documentId: string) {
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

async function getShareLink(settings: PluginSettings, documentId: string) {
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
async function createDocument(editor: Editor, settings: PluginSettings, paperlessUrl: PaperlessUrl) {
	// Create the parent folder
	const folderPath = normalizePath(settings.documentStoragePath);
	if (folderPath) {
		const folderRef = this.app.vault.getAbstractFileByPath(folderPath);
		const folderExists = !!(folderRef) && folderRef instanceof TFolder;
		if (!folderExists) {
			await this.app.vault.createFolder(folderPath);
		}
	}
	
	const filename = 'paperless-' + paperlessUrl.documentId + '.pdf';
	const fileRef = this.app.vault.getAbstractFileByPath(folderPath + '/' + filename); 
	const fileExists = !!(fileRef) && fileRef instanceof TFile;
	if (!fileExists) {
		const shareLink = await getShareLink(settings, paperlessUrl.documentId);
		if (shareLink) {
			await this.app.vault.create(folderPath + '/' + filename, shareLink.href);
		}
	}

	editor.replaceRange('![[' + filename + ']]', paperlessUrl.range.from, paperlessUrl.range.to);
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

	async displayTags(tagDiv: HTMLDivElement, documentId: string) {
		const thumbUrl = this.settings.paperlessUrl + '/api/documents/' + documentId + '/';
		const result = await requestUrl({
			url: thumbUrl.toString(),
			headers: {
				'Authorization': 'token ' + this.settings.paperlessAuthToken
			}
		})
		const tags = result.json['tags']
		for (let x = 0; x < tags.length; x++) {
			const currentTag = tagDiv.createDiv();
			const tagData = tagCache.get(tags[x]);					
			const tagStr = currentTag.createEl('span', {text: tagData['name']});
			tagStr.setCssStyles({color: tagData['text_color'], fontSize: '0.7em'});
			currentTag.setCssStyles({background: tagData['color'], borderRadius: '8px', padding: '2px', marginTop: '1px', marginRight: '5px'})
		}
	};

	async onOpen() {
		const {contentEl} = this;
		if (cachedResult == null) {
			await refreshCacheFromPaperless(this.settings);
		}

		const documentDiv = contentEl.createDiv({cls: 'obsidian-paperless-row'});
		const left = documentDiv.createDiv({cls: 'obsidian-paperless-column'});
		const right = documentDiv.createDiv({cls: 'obsidian-paperless-column'});
		const bottomDiv = contentEl.createDiv();
		const availableDocumentIds = cachedResult.json['all'].sort((a:String, b:String) => {return +a - +b}).reverse();
		let observer = new IntersectionObserver(() => {
			const startIndex = this.page;
			let endIndex = this.page + 16;
			if (endIndex > availableDocumentIds.length) {
				endIndex = availableDocumentIds.length;
			}
			this.page = endIndex;
			for (let i = startIndex; i < endIndex; i++) {
				const documentId = availableDocumentIds[i];
				const overallDiv = ( i & 1 ) ? right.createDiv({cls: 'obsidian-paperless-overallDiv'}) : left.createDiv({cls: 'obsidian-paperless-overallDiv'});
				const imageDiv = overallDiv.createDiv({cls: 'obsidian-paperless-imageDiv'});
				const tagDiv = overallDiv.createDiv({cls: 'obsidian-paperless-tagDiv'});
				this.displayTags(tagDiv, documentId);
				const imgElement = imageDiv.createEl('img');
				imgElement.width = 260;
				imgElement.onclick = () => {
					createDocument(this.editor, this.settings, documentId);
					overallDiv.setCssStyles({opacity: '0.5'})
				}
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
				})
				.inputEl.type = 'password');
		new Setting(containerEl)
			.setName('Document storage path')
			.setDesc('Location for stored documents.')
			.addText(text => text
				.setValue(this.plugin.settings.documentStoragePath)
				.onChange(async (value) => {
					this.plugin.settings.documentStoragePath = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Test connection')
			.setDesc('Validate the connection between obsidian and your paperless instance.')
			.addButton(async (button) => {
				button.setButtonText("Test connection")
				button.onClick(async() => {
					testConnection(this.plugin.settings)
				})
			})
	}
}
