/*jslint browser: true, forin: true, eqeq: true, white: true, sloppy: true, vars: true, nomen: true */
/*global $, jQuery, _, asm, common, config, controller, dlgfx, format, header, html, tableform, validate */

$(function() {

    var litters = {

        lastanimal: null,

        model: function() {
            var dialog = {
                add_title: _("Add litter"),
                edit_title: _("Edit litter"),
                edit_perm: 'cll',
                helper_text: _("Litters need at least a required date and number."),
                close_on_ok: false,
                hide_read_only: true, 
                columns: 1,
                fields: [
                    { json_field: "ACCEPTANCENUMBER", post_field: "litterref", label: _("Litter Reference"), type: "text",
                        tooltip: _("A unique reference for this litter"), validation: "notblank" },
                    { json_field: "PARENTANIMALID", post_field: "animal", label: _("Mother"), type: "animal", animalfilter: "female" },
                    { json_field: "ANIMALS", post_field: "animals", label: _("Littermates"), type: "animalmulti", readonly: true },
                    { json_field: "SPECIESID", post_field: "species", label: _("Species"), type: "select", 
                        options: { rows: controller.species, valuefield: "ID", displayfield: "SPECIESNAME" }},
                    { json_field: "DATE", post_field: "startdate", label: _("Start date"), 
                        tooltip: _("The date the litter entered the shelter"), type: "date", validation: "notblank" },
                    { json_field: "NUMBERINLITTER", post_field: "numberinlitter", label: _("Number in litter"), type: "number", validation: "notblank" },
                    { json_field: "INVALIDDATE", post_field: "expirydate", label: _("Expiry date"), type: "date" },
                    { json_field: "COMMENTS", post_field: "comments", label: _("Comments"), type: "textarea" }
                ]
            };

            var table = {
                rows: controller.rows,
                idcolumn: "ID",
                edit: function(row) {
                    $("#animal").animalchooser("clear");
                    tableform.fields_populate_from_json(dialog.fields, row);
                    tableform.dialog_show_edit(dialog, row)
                        .then(function() {
                            tableform.fields_update_row(dialog.fields, row);
                            litters.set_extra_fields(row);
                            return tableform.fields_post(dialog.fields, "mode=update&litterid=" + row.ID, "litters");
                        })
                        .then(function(response) {
                            tableform.table_update(table);
                            tableform.dialog_close();
                        });
                },
                complete: function(row) {
                    return (row.INVALIDDATE && format.date_js(row.INVALIDATE) <= new Date()) || row.CACHEDANIMALSLEFT == 0;
                },
                columns: [
                    { field: "ACCEPTANCENUMBER", display: _("Litter Ref") },
                    { field: "PARENTANIMALID", display: _("Parent"), formatter: function(row) {
                        if (row.PARENTANIMALID) {
                            return '<a href="animal?id=' + row.PARENTANIMALID + '">' + row.MOTHERNAME + ' - ' + row.MOTHERCODE + '</a>';
                        }
                        return "";
                    }},
                    { field: "SPECIESNAME", display: _("Species") },
                    { field: "DATE", display: _("Starts"), formatter: tableform.format_date, initialsort: true, initialsortdirection: "desc" },
                    { field: "INVALIDDATE", display: _("Expires"), formatter: tableform.format_date },
                    { field: "NUMBERINLITTER", display: _("Number in litter") },
                    { field: "CACHEDANIMALSLEFT", display: _("Remaining") },
                    { field: "COMMENTS", display: _("Comments"), formatter: tableform.format_comments }
                ]
            };

            var buttons = [
                { id: "new", text: _("New Litter"), icon: "new", enabled: "always", perm: "all", 
                     click: function() { 
                        var formdata = "mode=nextlitterid";
                        common.ajax_post("litters", formdata)
                            .then(function(result) { 
                                return tableform.dialog_show_add(dialog, { 
                                    onload: function() {
                                        litters.lastanimal = null;
                                        $("#litterref").val(result);
                                        $("#animal").animalchooser("clear");
                                    }
                                });
                            })
                            .then(function() {
                                return tableform.fields_post(dialog.fields, "mode=create", "litters");
                            })
                            .then(function(response) {
                                var row = {};
                                row.ID = response;
                                tableform.fields_update_row(dialog.fields, row);
                                litters.set_extra_fields(row);
                                controller.rows.push(row);
                                tableform.table_update(table);
                                tableform.dialog_close();
                            });
                     } 
                 },
                 { id: "delete", text: _("Delete"), icon: "delete", enabled: "multi", perm: "dll", 
                     click: function() { 
                         tableform.delete_dialog()
                             .then(function() {
                                 tableform.buttons_default_state(buttons);
                                 var ids = tableform.table_ids(table);
                                 return common.ajax_post("litters", "mode=delete&ids=" + ids);
                             })
                             .then(function() {
                                 tableform.table_remove_selected_from_json(table, controller.rows);
                                 tableform.table_update(table);
                             });
                     } 
                 },
                 { id: "littermates", text: _("Littermates"), icon: "litter", enabled: "one", perm: "va", 
                     click: function() { 
                         var row = tableform.table_selected_row(table);
                         common.route("animal_find_results?mode=ADVANCED&q=&litterid=" + encodeURIComponent(row.ACCEPTANCENUMBER));
                     }
                 }
            ];
            this.dialog = dialog;
            this.buttons = buttons;
            this.table = table;
        },

        render: function() {
            var s = "";
            this.model();
            s += tableform.dialog_render(this.dialog);
            s += html.content_header(_("Litters"));
            s += tableform.buttons_render(this.buttons);
            s += tableform.table_render(this.table);
            s += html.content_footer();
            return s;
        },

        bind: function() {
            tableform.dialog_bind(this.dialog);
            tableform.buttons_bind(this.buttons);
            tableform.table_bind(this.table, this.buttons);
            $("#animal").animalchooser().bind("animalchooserchange", function(event, rec) { litters.lastanimal = rec; $("#species").select("value", rec.SPECIESID); });
            $("#animal").animalchooser().bind("animalchooserloaded", function(event, rec) { litters.lastanimal = rec; });
        },

        set_extra_fields: function(row) {
            row.MOTHERNAME = ""; row.MOTHERCODE = "";
            if (litters.lastanimal) {
                row.MOTHERNAME = litters.lastanimal.ANIMALNAME;
                row.MOTHERCODE = litters.lastanimal.SHELTERCODE;
            }
            row.SPECIESNAME = common.get_field(controller.species, row.SPECIESID, "SPECIESNAME");
            if (row.CACHEDANIMALSLEFT === undefined) {
                row.CACHEDANIMALSLEFT = row.NUMBERINLITTER;
            }
        },

        destroy: function() {
            common.widget_destroy("#animal");
            tableform.dialog_destroy();
            this.lastanimal = null;
        },

        name: "litters",
        animation: "book",
        title: function() { return _("Litters"); },
        routes: {
            "litters": function() { common.module_loadandstart("litters", "litters"); }
        }

    };

    common.module_register(litters);

});
