import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface PluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
	mySetting: 'default'
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

		// This adds a settings tab so the user can configure various aspects of the plugin
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

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
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
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
