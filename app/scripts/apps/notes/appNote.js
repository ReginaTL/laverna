/*global define*/
define([
    'marionette',
    'app'
], function (Marionette, App) {
    'use strict';

    /**
     * Submodule which shows note content
     */
    var AppNote = App.module('AppNote', { startWithParent: false }),
        executeAction,
        API;

    AppNote.on('start', function () {
        App.log('AppNote is started');
    });

    AppNote.on('stop', function () {
        App.log('AppNote is stoped');
    });

    /**
     * The router
     */
    AppNote.Router = Marionette.AppRouter.extend({
        appRoutes: {
            ''          : 'showNotes',
            'notes/add'       : 'addNote',
            'notes/edit/:id'  : 'editNote',
            'notes(/f/:filter)(/p:page)'   : 'showNotes',
            'notes(/f/:filter)(/p:page)(/show/:id)'  : 'showNote',
        }
    });

    /**
     * Start application
     */
    executeAction = function (action, args) {
        App.startSubApp('AppNote');
        action(args);
    };

    /**
     * Controller
     */
    API = {
        // Show list of notes
        showNotes: function (filter, page) {
            var args = { filter : filter, page : page };
            if (filter && typeof(filter) === 'object') {
                args = filter;
            }
            require(['apps/notes/list/controller'], function (List) {
                API.sidebarShown = true;
                executeAction(new List().listNotes, args);
            });
        },

        // Show content of note
        showNote: function (filter, page, id) {
            var args = {
                id     : id,
                filter : filter,
                page   : page
            };
            require(['apps/notes/show/showController'], function (Show) {
                App.trigger('notes:show', args);
                executeAction(new Show().showNote, args);
            });
        },

        // Add new note
        addNote: function () {
        },

        // Edit an existing note
        editNote: function (id) {
            App.log('edit note ' + id);
        }
    };

    /**
     * Router events
     */
    App.on('notes:list', function () {
        App.navigate('notes');
        API.showNotes();
    });

    App.on('notes:show', function (args) {
        if (!API.sidebarShown) {
            API.showNotes(args);
        }
    });

    /**
     * Register the router
     */
    App.addInitializer(function(){
        new AppNote.Router({
            controller: API
        });
    });

    return AppNote;
});
