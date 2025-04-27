import { App, Editor, MarkdownView, Modal, normalizePath, Notice, Plugin, PluginSettingTab, requestUrl, RequestUrlResponse, Setting, setIcon, TFolder, TFile } from 'obsidian';
import ObsidianPaperless from './main';
import { testConnection } from './actions';

export interface PluginSettings {
	paperlessUrl: string;
	paperlessAuthToken: string;
	documentStoragePath: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	paperlessUrl: '',
	paperlessAuthToken: '',
	documentStoragePath: ''
}

export class SettingTab extends PluginSettingTab {
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
