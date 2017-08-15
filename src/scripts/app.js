var app = angular.module('members', []);

app.controller('mainCtrl', ['$scope', '$filter', function ($scope, $filter) {
    var vars = $scope.vars = {
        date: new Date(),
        showAddModal: false,
        showIncomeModal: false,
        currentMember: null,
        incomeList: []
    }


    var model = $scope.model = {
        performance: 0,
        total: 0,
        members: [{ key: 'M00001', name: '会员1' }, { key: 'M00002', name: '会员2' }, { key: 'M00003', name: '会员3' }],
        incomeData: []
    }
    $scope.formModel = {
        currentDate: new Date()
    }

    $scope.modal = {
        close: function (modalKey) {
            vars[modalKey] = false;
        }
    }

    $scope.showAddModal = function (member) {
        vars.currentMember = member;

        $scope.addForm.rows = [];
        $scope.addForm.addNewRow(member);
        vars.showAddModal = !vars.showAddModal;
    }

    $scope.showIncomeModal = function (member) {
        vars.currentMember = member;
        $scope.settlement();

        vars.showIncomeModal = !vars.showIncomeModal;
    }

    $scope.settlement = function () {
        var points = $scope.query.points(vars.currentMember.key);
        var recommend = $scope.query.recommend(vars.currentMember.key);
        var inPoint = $scope.query.inPoint(vars.currentMember.key);
        var rows = [points, recommend, inPoint];
        model.incomeData = rows;
    }


    $scope.addForm = {
        rows: [],
        members: {},
        amounts: {},
        addNewRow: function (member) {
            var childs = $filter('filter')(model.members, function (item) { return item.parentKey === member.key });
            this.rows.push({ key: 'm' + (childs.length + 1), index: childs.length + 1 });
        },
        apply: function () {
            var newMembers = [];
            for (var i = 0, ii = this.rows.length; i < ii; i++) {
                var formItem = this.rows[i],
                    currentKey = formItem.key,
                    recentNode = this.findRecentNode(vars.currentMember);

                var newItem = {
                    key: vars.currentMember.key + currentKey,
                    name: vars.currentMember.name + '-' + (this.members[formItem.key] || formItem.index),
                    parent: vars.currentMember.name,
                    parentKey: vars.currentMember.key,
                    parentNodeKey: recentNode.key,
                    parentNodeName: recentNode.name,
                    amount: (this.amounts[formItem.key] - 0) || 0,
                    date: new Date()
                };
                newMembers.push(newItem);
                $scope.query.total(newItem);
            }
            model.members = model.members.concat(newMembers);
            vars.showAddModal = false;
        },
        findRecentNode: function (member) {
            var childs = $filter('filter')(model.members, function (item) {
                return item.parentKey === member.key || item.parentNodeKey === member.key
            });
            if (childs.length < 3) return member;

            for (var i = 0, ii = childs.length; i < ii; i++) {
                var childNodes = $filter('filter')(model.members, function (item) { return item.parentNodeKey === childs[i].key });
                if (childNodes.length < 3) return childs[i];
            }
        }
    }

    $scope.storage = {
        saveIncome: function (newMembers) {
            // vars.incomeList.push({
            //     key: newMembers.key,
            //     type: 'Points',
            //     name: '积分',
            //     freezed: true,
            //     amount: newMembers.amount * 2
            // });

            // vars.incomeList.push({
            //     key: newMembers.parentKey,
            //     type: 'Recommend',
            //     name: '直推奖',
            //     freezed: false,
            //     amount: newMembers.amount * 0.2
            // });
        }
    }

    $scope.query = {
        total: function (newMember) {
            model.total += newMember.amount;
        },
        income: function (memberKey) {

        },
        //积分
        points: function (memberKey) {
            var nodeItem = $filter('filter')(model.members, function (item) { return item.key === memberKey })[0];
            return {
                type: 'Points',
                name: '积分',
                freezed: true,
                amount: nodeItem.amount * 2
            }
        },
        //直推
        recommend: function (memberKey) {
            var childs = $filter('filter')(model.members, function (item) { return item.parentKey === memberKey }),
                maxAmount = 0;
            for (var i = 0, ii = childs.length; i < ii; i++) {
                maxAmount = Math.max(maxAmount, childs[i].amount);
            }
            return {
                type: 'Recommend',
                name: '直推奖',
                freezed: false,
                amount: maxAmount * 0.2
            }
        },
        //见点
        inPoint: function (memberKey) {
            var config = {
                level1: {
                    layers: [1, 3, 5, 7],
                    rate: 0.02
                },
                level2: {
                    layers: [9, 11, 13],
                    rate: 0.03
                },
                level3: {
                    layers: [15, 17, 19],
                    rate: 0.04
                },
                getRate: function (level) {
                    for (var key in config) {
                        if (typeof config[key] !== 'function') {
                            var levelItem = config[key];
                            if (levelItem.layers && levelItem.layers.indexOf(level - 0) >= 0) {
                                return levelItem.rate;
                            }
                        }
                    }
                }
            }
            var nodeItem = $filter('filter')(model.members, function (item) { return item.key === memberKey })[0];

            var allLayers = this.loop(nodeItem.key).layers, total = 0;
            for (var key in allLayers) {
                var rateVal = config.getRate(key), members = allLayers[key], amount = 0;
                for (var i = 0, ii = members.length; i < ii; i++) {
                    amount += members[i].amount
                }
                amount = Math.round(amount * rateVal);
                total += amount;
            }
            return {
                type: 'InPoint',
                name: '见点奖',
                freezed: false,
                amount: total
            }
        },

        loop: function (key, cache) {
            if (!cache) cache = { max: 0, layers: {} };
            var childs = $filter('filter')(model.members, function (item) { return item.parentKey === key });
            cache.max++;
            if (!cache.layers[cache.max]) cache.layers[cache.max] = [];
            if (!childs.length || cache.max <= 19) { return cache; }
            for (var i = 0, ii = childs.length; i < ii; i++) {
                cache.layers[cache.max].push(childs[i]);
                return this.loop(childs[i].key, cache);
            }
        },

        groupIncome: function (member) {
            // var list = this.income(member.key), incomeData = [], cache = {};
            // for (var i = 0, ii = list.length; i < ii; i++) {
            //     var val = cache[list[i].type] || 0;
            //     cache[list[i].type] = val + list[i].amount;
            // }
            // for (var cacheKey in cache) {
            //     var newMemberItem = angular.copy($filter('filter')(list, { type: cacheKey })[0]);
            //     newMemberItem.amount = cache[cacheKey];
            //     incomeData.push(newMemberItem)
            // }
            // return incomeData;
        }
    }

}])