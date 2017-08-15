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
        vars.showIncomeModal = !vars.showIncomeModal;

        model.incomeData = $scope.query.groupIncome(member);
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
                    amount: (this.amounts[formItem.key] - 0) || 0
                };
                newMembers.push(newItem);

                $scope.query.total(newItem);
                $scope.storage.saveIncome(newItem);
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
            vars.incomeList.push({
                key: newMembers.key,
                type: 'Points',
                name: '积分',
                freezed: true,
                amount: newMembers.amount * 2
            });

            vars.incomeList.push({
                key: newMembers.parentKey,
                type: 'Recommend',
                name: '直推奖',
                freezed: false,
                amount: newMembers.amount * 0.2
            });
        }
    }

    $scope.query = {
        total: function (newMember) {
            model.total += newMember.amount;
        },
        income: function (memberKey) {
            return $filter('filter')(vars.incomeList, function (item) { return item.key === memberKey });
        },
        groupIncome: function (member) {
            var list = this.income(member.key), incomeData = [], cache = {};
            for (var i = 0, ii = list.length; i < ii; i++) {
                var val = cache[list[i].type] || 0;
                cache[list[i].type] = val + list[i].amount;
            }
            for (var cacheKey in cache) {
                var newMemberItem = angular.copy($filter('filter')(list, { type: cacheKey })[0]);
                newMemberItem.amount = cache[cacheKey];
                incomeData.push(newMemberItem)
            }
            return incomeData;
        }
    }

}])