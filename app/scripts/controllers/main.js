/*global define*/
// /*global prompt*/
/*global sjcl*/
define([
    'underscore',
    'backbone',
    'marionette',
    'app',
    // collections
    'collections/notes',
    'collections/notebooks',
    'collections/tags',
    'collections/configs',
    // Views
    'noteForm',
    'noteItem',
    'noteSidebar',
    'notebookLayout',
    'notebookSidebar',
    'notebookForm',
    'tagsSidebar',
    'tagForm',
    'helpView',
    'configsView',
    'sjcl'
],
function(_, Backbone, Marionette, App, CollectionNotes, CollectionNotebooks, CollectionTags, CollectionConfigs, NoteForm, NoteItem, NoteSidebar, NotebookLayout, NotebookSidebar, NotebookForm, TagsSidebar, TagForm, HelpView, ConfigsView) {
    'use strict';

    var Controller = Marionette.Controller.extend({

        /**
         * Initialization
         */
        initialize: function() {
            // Fetch configs
            this.Configs = new CollectionConfigs();
            this.Configs.fetch({reset: true});

            // Set default set of configs
            if (this.Configs.length === 0) {
                this.Configs.firstStart();
            }

            // Configs ToJSON
            this.configs = this.Configs.getConfigs();

            // Ask password
            if (this.Configs.get('encrypt').get('value') === 1) {
                this.auth();
            }

            // Fetch notes
            this.Notes = new CollectionNotes();
            // this.Notes.setEncryptionData({configs: this.Configs, key: this.secureKey});

            // Fetch notebooks
            this.Notebooks = new CollectionNotebooks();
            // this.Notebooks.setEncryptionData({configs: this.Configs, key: this.secureKey});
            // this.Notebooks.fetch({reset: true});

            // Fetch tags
            this.Tags = new CollectionTags();
            this.Tags.fetch({reset: true});

            // Show all notes
            this.on('notes.shown', this.showAllNotes);
            this.on('showNote', this.showNote);
            this.on('noteEdit', this.noteEdit);
        },

        /**
         * Authorization
         */
        auth: function () {
            // var password = prompt('Please enter your password'),
            var password = '1',
                pwd = this.Configs.get('encryptPass').get('value');

            if (pwd.toString() === sjcl.hash.sha256.hash(password).toString()) {
                this.configs.secureKey = sjcl.misc.pbkdf2(
                    password,
                    this.Configs.get('encryptSalt').toString(),
                    1000
                );
            } else {
                this.auth();
            }
        },

        /**
         * Index page
         */
        index: function (notebook, page) {
            App.content.reset();
            this.trigger('notes.shown', {
                notebookId : Math.floor(notebook),
                lastPage   : page
            });
        },

        /* ------------------------------
         * Notes actions
         * ------------------------------ */
        /**
         * Fetching note's model
         */
        fetchNote: function (id, evt) {
            var that = this,
                model;

            evt = (evt === undefined) ? 'showNote' : evt;

            if (this.Notes.length === 0) {
                model = new this.Notes.model({id : id});
                model.fetch({
                    success: function () {
                        that.trigger(evt, model);
                    },
                    error: function () {
                        that.trigger(evt);
                    }
                });
            } else {
                model = this.Notes.get(id);
                that.trigger(evt, model);
            }
        },

        fetchNotebooks: function (args, evt) {
            var self = this;
            this.notebooksFetched = true;
            this.Notebooks.fetch({
                reset: true,
                success: function () {
                    self.trigger(evt, args);
                },
                error: function () {
                    self.trigger(evt, args);
                }
            });
        },

        /**
         * Show note's content
         */
        showNote: function (note) {
            var content = {
                    model      : note,
                    collection : this.Notes,
                    notebooks  : this.Notebooks,
                    configs    : this.configs
                };

            App.content.show(new NoteItem(content));
        },

        /**
         * Fetch notes from DB
         */
        showAllNotes: function (args) {
            var that = this;

            if (this.Notes.length === 0) {
                this.Notes.fetch({
                    success: function () {
                        that.showSidebarNotes(args);
                    }
                });
            } else {
                that.showSidebarNotes(args);
            }
        },

        /**
         * Show list of notes in sidebar
         */
        showSidebarNotes: function (args) {
            if (this.Notebooks.length === 0 && !this.notebooksFetched) {
                this.fetchNotebooks(args, 'notes.shown');
                return;
            }

            var notes = this.Notes.clone(),
                arg = _.extend({
                    filter     : 'active',
                    title      : 'Inbox',
                    configs    : this.configs,
                    collection : notes
                }, args),
                notebookMod;

            arg.notebookId = (isNaN(arg.notebookId)) ? 0 : arg.notebookId;
            arg.tagId = (isNaN(arg.tagId)) ? 0 : arg.tagId;
            arg.lastPage = (isNaN(arg.lastPage)) ? 1 : arg.lastPage;

            if (arg.notebookId !== 0) {
                notebookMod = this.Notebooks.get(arg.notebookId).decrypt(this.configs);
                arg.title = notebookMod.name;
            }

            // Show sidebar
            App.sidebar.show(new NoteSidebar(arg));
        },

        /**
         * Search specific note
         */
        noteSearch: function (query, page, id) {
            this.trigger('notes.shown', {
                filter      : 'search',
                searchQuery : query,
                activeNote  : id,
                title       : 'Search',
                lastPage    : page
            });

            this.fetchNote(id);
        },

        /**
         * Show favorite notes
         */
        noteFavorite: function (page, id) {
            this.trigger('notes.shown', {
                filter     : 'favorite',
                title      : 'Favorite notes',
                activeNote : id,
                lastPage   : page
            });

            this.fetchNote(id);
        },

        /**
         * Show notes which is deleted
         */
        noteTrashed: function (page, id) {
            this.trigger('notes.shown', {
                filter     : 'trashed',
                title      : 'Removed notes',
                activeNote : id,
                lastPage   : page
            });

            this.fetchNote(id);
        },

        /**
         * Show list of notes which has been tagged with :tag
         */
        noteTag: function (tag, page, id) {
            var tagModel = this.Tags.get(tag);
            this.trigger('notes.shown', {
                filter     : 'tagged',
                tagId      : tag,
                activeNote : id,
                title      : 'Tag : ' + tagModel.get('name'),
                lastPage   : page
            });

            this.fetchNote(id);
        },

        /**
         * Show note's content
         */
        noteShow: function (notebook, page, id) {
            if (id === undefined) {
                id = notebook;
                notebook = 0;
            }

            // Show sidebar
            this.trigger('notes.shown', {
                filter     : 'active',
                lastPage   : page,
                activeNote : id,
                notebookId : Math.floor(notebook)
            });

            // Show content
            this.fetchNote(id);
        },

        /**
         * Add a new note
         */
        noteAdd: function () {
            // Show sidebar
            this.trigger('notes.shown');

            // Form
            var content = new NoteForm({
                collection     : this.Notes,
                notebooks      : this.Notebooks,
                collectionTags : this.Tags,
                configs        : this.configs
            });

            App.content.show(content);
            document.title = 'Creating new note';
            content.trigger('shown');
        },

        /**
         * Edit an existing note
         */
        noteEdit: function (note) {
            // For first fetch this note
            if (typeof(note) === 'string') {
                return this.fetchNote(note, 'noteEdit');
            }

            // Show Sidebar
            this.trigger('notes.shown');

            var content = {
                model          : note,
                collection     : this.Notes,
                notebooks      : this.Notebooks,
                collectionTags : this.Tags,
                configs        : this.configs
            };

            // Show form
            content = new NoteForm(content);
            App.content.show(content);
            content.trigger('shown');

            document.title = 'Editing note: ' + note.get('title');
        },

        /**
         * Remove Note
         */
        noteRemove: function (id) {
            var note,
                next,
                url;

            url = '/note/0/p1/';

            if (this.Notes.length !== 0) {
                note = this.Notes.get(id);
                note.toTrash();
                next = note.prev();

                if (next) {
                    url += 'show/' + next.get('id');
                }
            }

            Backbone.history.navigate(url, true);
        },

        /* ------------------------------
         * Notebooks actions
         * ------------------------------ */
        notebooks: function () {
            var tags, notebook, sidebar;

            // Notebooks list
            notebook = {
                collection : this.Notebooks,
                configs    : this.configs,
            };

            // Tags list
            tags = {
                collection : this.Tags
            };

            // Show sidebar layout
            sidebar = {
                collectionNotebooks: this.Notebooks,
                collectionTags     : this.Tags,
                configs            : this.Configs
            };

            // Notebooks & tags list in sidebar
            this.Notebooks.fetch({
                success: function () {
                    sidebar = new NotebookLayout(sidebar);
                    App.sidebar.show(sidebar);

                    sidebar.notebooks.show(new NotebookSidebar(notebook));
                    sidebar.tags.show(new TagsSidebar(tags));
                }
            });

            App.content.reset();
        },

        /**
         * Add new notebook
         */
        notebookAdd: function () {
            var content = new NotebookForm({
                collection: this.Notebooks,
                configs: this.configs
            });

            App.modal.show(content);
        },

        /**
         * Edit existing notebook
         */
        notebookEdit: function (id) {
            var notebook;
            if (this.Notebooks.length === 0) {
                notebook = new this.Notebooks.model({id: id});
            }
            else {
                notebook = this.Notebooks.get(id);
            }

            var content = {
                model: notebook,
                collection: this.Notebooks,
                configs: this.configs
            };

            notebook.fetch({
                success: function () {
                    App.modal.show(new NotebookForm(content));
                }
            });
        },

        /**
         * Remove notebook
         */
        notebookRemove: function (id) {
            var notebook;

            if (this.Notebooks.length === 0) {
                notebook = new this.Notebooks.model({id: id});
            } else {
                notebook = this.Notebooks.get(id);
            }

            if (notebook !== undefined) {
                notebook.destroy();
            }

            this.Notebooks.fetch({
                reset: true,
                success: function () {
                    Backbone.history.navigate('#/notebooks', true);
                }
            });
        },

        /* ---------------------------------
         * Tags actions
         * --------------------------------- */
        tagAdd: function() {
            var content = new TagForm({
                collection: this.Tags
            });

            App.modal.show(content);
        },

        /**
         * Edit existing tag
         */
        tagEdit: function(id) {
            var content = new TagForm({
                collection: this.Tags,
                model: this.Tags.get(id)
            });
            App.modal.show(content);
        },

        /**
         * Remove tag
         */
        tagRemove: function (id) {
            var model = this.Tags.get(id);
            model.destroy();
            Backbone.history.navigate('#/notebooks', true);
        },

        /**
         * Help View Shortcuts
         */
        help: function () {
            App.modal.show(new HelpView({
                collection: this.Configs
            }));
        },

        /**
         * Settings page
         */
        settings: function () {
            App.modal.show(new ConfigsView({
                collection: this.Configs
            }));
        }

    });

    return Controller;
});
