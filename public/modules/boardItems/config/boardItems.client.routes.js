'use strict';

// Setting up route
angular.module('boardItems').config(['$stateProvider',
	function($stateProvider) {
		// boardItems state routing
		$stateProvider.
		state('listBoardItems', {
			url: '/boardItems/:groupId',
			templateUrl: 'modules/boardItems/views/list-boardItems.client.view.html'
		}).
		state('viewBoardItem', {
			url: '/boardItems/:boardItemId/:groupId',
			templateUrl: 'modules/boardItems/views/view-boardItem.client.view.html'
		});
	}
]);