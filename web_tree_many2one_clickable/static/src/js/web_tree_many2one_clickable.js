//-*- coding: utf-8 -*-
//############################################################################
//
//   OpenERP, Open Source Management Solution
//   This module copyright
//     (C) 2013 Therp BV (<http://therp.nl>).
//     (c) 2015 Serv. Tecnol. Avanzados (http://www.serviciosbaeza.com)
//              Pedro M. Baeza <pedro.baeza@serviciosbaeza.com>
//
//   This program is free software: you can redistribute it and/or modify
//   it under the terms of the GNU Affero General Public License as
//   published by the Free Software Foundation, either version 3 of the
//   License, or (at your option) any later version.
//
//   This program is distributed in the hope that it will be useful,
//   but WITHOUT ANY WARRANTY; without even the implied warranty of
//   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//   GNU Affero General Public License for more details.
//
//   You should have received a copy of the GNU Affero General Public License
//   along with this program.  If not, see <http://www.gnu.org/licenses/>.
//
//############################################################################

openerp.web_tree_many2one_clickable = function(instance, local)
{
    instance.web.list.Column.include({
        /*
        Load config parameter at init and store it in an accessible variable.
        */
        init: function(id, tag, attrs) {
            this._super(id, tag, attrs);
            if (this.widget == 'many2one_clickable') {
                this.use_many2one_clickable = true;
            } else if (this.type == 'many2one') {
                this.get_options();
            }
        },

        get_options: function() {
            if (_.isUndefined(this.ir_option_clickable_loaded)) {
                var self = this; // Needed for binding the instance
                this.ir_option_clickable_loaded = $.Deferred();
                this.use_many2one_clickable = false;
                (new instance.web.Model("ir.config_parameter"))
                    .query(["value"])
                    .filter([['key', '=', 'web_tree_many2one_clickable.default']])
                    .first()
                    .then(function(param) {
                        if (param) {
                            self.use_many2one_clickable = (param.value.toLowerCase() == 'true');
                        }
                        self.ir_option_clickable_loaded.resolve();
                    });
                return this.ir_option_clickable_loaded;
            }
            return $.when();
        },

        _format: function (row_data, options)
        {
            if (this.use_many2one_clickable && !!row_data[this.id]) {
                var ctx = this.context;
                var values = {
                    model: this.relation,
                    id: row_data[this.id].value[0],
                    name: _.escape(row_data[this.id].value[1] || options.value_if_empty),
                    context: _.escape(_.isObject(ctx) ? JSON.stringify(ctx) : ctx),
                };
                if(this.type == 'reference' && !!row_data[this.id + '__display'])
                {
                    values.model = row_data[this.id].value.split(',', 1)[0];
                    values.id = row_data[this.id].value.split(',', 2)[1];
                    values.name = _.escape(row_data[this.id + '__display'].value || options.value_if_empty);
                }
                return _.str.sprintf(
                    '<a class="oe_form_uri" data-many2one-clickable-model="%(model)s" data-many2one-clickable-id="%(id)s" data-many2one-clickable-context="%(context)s">%(name)s</a>',
                    values
                );
            }
            else {
                return this._super(row_data, options);
            }
        },
    });

    /* many2one_clickable widget */

    instance.web.list.columns.add(
            'field.many2one_clickable',
            'instance.web_tree_many2one_clickable.Many2OneClickable');

    instance.web_tree_many2one_clickable.Many2OneClickable = openerp.web.list.Column.extend({
    });

    /* click action */

    instance.web.ListView.List.include({
        render: function () {
            var result = this._super(this, arguments),
                self = this;

            this.$current.delegate('a[data-many2one-clickable-model]', 'click', function () {
                var $this = $(this);

                // Field data
                var model_name = $this.data('many2one-clickable-model');
                var record_id = $this.data('many2one-clickable-id');
                var local_context = $this.data('many2one-clickable-context');

                // Row data
                var row_id = $this.parents('tr:first').data('id');
                var row_vals = self.records.get(row_id).toContext();

                // Parent data
                var parent_vals = self.dataset.parent_view &&
                    self.dataset.parent_view.get_fields_values() || {};

                var eval_context = _.extend({}, row_vals, {'parent': parent_vals});

                // FIX: Delete undefined context values
                for ( var key in eval_context ) {
                    if ( eval_context.hasOwnProperty(key) ) {
                        if ( typeof eval_context[key] === 'undefined' ) {
                            delete eval_context[key];
                        }
                    }
                }

                var context = new instance.web.CompoundContext(self.dataset.get_context(), {
                    'active_model': model_name,
                    'active_id': record_id,
                    'active_ids': [record_id],
                }, local_context).set_eval_context(eval_context).eval();

                // FIX: Avoid view_ref propagation
                for ( var key in context ) {
                    if ( context.hasOwnProperty(key) ) {
                        if ( _.string.endsWith(key, '_view_ref' ) ) {
                            delete context[key];
                        }
                    }
                }

                new instance.web.Model(model_name)
                    .call('get_formview_id', [record_id, context])
                    .then(function (view_id) {
                        if ( _.isArray(view_id) ) {
                            view_id = view_id[0];
                        }

                        self.view.do_action({
                            type: 'ir.actions.act_window',
                            res_model: model_name,
                            res_id: record_id,
                            views: [[view_id, 'form']],
                            context: context,
                        });
                    });
            });

            return result;
        },
    });
};
