import { App, Editor, MarkdownView, Modal, normalizePath, Notice, Plugin, PluginSettingTab, requestUrl, RequestUrlResponse, Setting, setIcon, TFolder, TFile } from 'obsidian';
import { PluginSettings } from './settings';
import { createDocument } from './actions';

export class DocumentSelectorModal extends Modal {
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

let cachedResult: RequestUrlResponse;
let tagCache = new Map();

export async function refreshCacheFromPaperless(settings: PluginSettings, silent=true) {
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
