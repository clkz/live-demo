var app = angular.module('members', []);

app.controller('mainCtrl', ['$scope', '$filter', function ($scope, $filter) {
    var vars = $scope.vars = {
        date: new Date(),
        showAddModal: false,
        showIncomeModal: false,
        currentMember: null,
        incomeList: [],
        releationList: [],
    }


    var model = $scope.model = {
        performance: 0,
        total: 0,
        dayOfTotal: 0,
        members: [{ key: 'M00001', name: '会员1' }, { key: 'M00002', name: '会员2' }, { key: 'M00003', name: '会员3' }],
        incomeData: []
    }
    var formModel = $scope.formModel = {
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
            var newMembers = [],
                parentKey = vars.currentMember.key,
                newItem = {};

            for (var i = 0, ii = this.rows.length; i < ii; i++) {
                var formItem = this.rows[i],
                    currentKey = formItem.key,
                    recentNode = this.findRecentNode(vars.currentMember);

                newItem = {
                    key: parentKey + currentKey,
                    name: vars.currentMember.name + '-' + (this.members[formItem.key] || formItem.index),
                    parent: vars.currentMember.name,
                    parentKey: parentKey,
                    parentNodeKey: recentNode.key,
                    parentNodeName: recentNode.name,
                    amount: (this.amounts[formItem.key] - 0) || 0,
                    createDate: $filter('date')(formModel.currentDate, 'yyyy-MM-dd')
                };
                newMembers.push(newItem);
            }
            model.members = model.members.concat(newMembers);

            for (var j = 0, jj = newMembers.length; j < jj; j++) {
                $scope.storage.saveRealtions(newMembers[j]);
            }

            $scope.storage.total();
            vars.showAddModal = false;
        },
        findRecentNode: function (member) {
            var directNodeList = $scope.query.directNodeList(member.key);
            if (directNodeList.length < 3) return member;

            var allChilds = $scope.query.findChilds(member.key);
            for (var i = 0, ii = allChilds.length; i < ii; i++) {
                var childNodes = $scope.query.directNodeList(allChilds[i].key);
                if (childNodes.length < 3) return allChilds[i];
            }
        }
    }

    $scope.storage = {
        total: function () {
            var total = 0,
                dayOfTotal = 0,
                currentDate = $filter('date')($scope.formModel.currentDate, 'yyyy-MM-dd');

            angular.forEach(model.members, function (item) {
                total += (item.amount || 0);
            });

            var todayMembers = $filter('filter')(model.members,
                function (item) { return item.createDate === currentDate });

            angular.forEach(todayMembers, function (item) {
                dayOfTotal += (item.amount || 0);
            });

            model.total = total;
            model.dayOfTotal = dayOfTotal;
        },
        loop: function (memberKey, callback) {
            var childs = $filter('filter')(model.members, function (item) { return item.key === memberKey });
            if (!childs.length) return;
            callback && callback(childs[0]);
            this.loop(childs[0].parentNodeKey, callback);
        },

        saveRealtions: function (member) {
            var index = 1;
            this.loop(member.parentNodeKey, function (item) {
                vars.releationList.push({
                    nodeKey: member.key,
                    parentNodeKey: item.key,
                    layerNumber: index++,
                    isDirect: member.parentKey === item.key
                })
            })
        },
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
        directNodeList: function (memberKey) {
            return $filter('filter')(vars.releationList,
                function (item) {
                    return item.parentNodeKey === memberKey && item.isDirect === true
                });
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
            var total = 0, releationList = $filter('filter')(vars.releationList, function (item) {
                return item.parentNodeKey = nodeItem.key;
            });

            angular.forEach(releationList, function (relationItem) {
                var rateVal = config.getRate(relationItem.layerNumber),
                    member = $filter('filter')(model.members, function (item) { return item.key === relationItem.nodeKey })[0];
                if (member && rateVal) {
                    total += Math.round(member.amount * rateVal)
                }
            });

            return {
                type: 'InPoint',
                name: '见点奖',
                freezed: false,
                amount: total
            }
        },

        findChilds: function (key, members) {
            if (!members) members = [];
            var childs = $filter('filter')(model.members, function (item) { return item.parentNodeKey === key });
            if (!childs.length) return members;
            members = members.concat(childs);
            for (var i = 0, ii = childs.length; i < ii; i++) {
                members = this.findChilds(childs[i].key, members);
            }
            return members;
        }
    }

}])