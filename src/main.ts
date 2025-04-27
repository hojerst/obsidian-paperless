import { App, Editor, MarkdownView, Modal, normalizePath, Notice, Plugin, PluginSettingTab, requestUrl, RequestUrlResponse, Setting, setIcon, TFolder, TFile } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS, SettingTab } from './settings';
import { DocumentSelectorModal, refreshCacheFromPaperless } from './documentselector';
import { createDocument, extractDocumentIdFromUrl } from './actions';

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
