﻿/** # Evolution strategy.

[Evolution strategy](https://en.wikipedia.org/wiki/Evolution_strategy) is maybe the simplest
evolutionary optimization method. At each step, one or more random deviations of each element are
generated, replacing their parent if they prove to be better.
*/
var EvolutionStrategy = metaheuristics.EvolutionStrategy = declare(Metaheuristic, {
	/** The constructor takes the following parameters:
	*/
	constructor: function EvolutionStrategy(params) {
		Metaheuristic.call(this, params);
		initialize(this, params)
			/** + `mutantCount=1` is the number of mutants generated per element at each step.
			*/
			.number('mutantCount', { coerce: true, defaultValue: 1, minimum: 1 })
			/** + `size=1`: state's size is 1 by default in this metaheuristic.
			*/
			.integer('size', { coerce: true, defaultValue: 1, minimum: 1 });
	},

	/** A `mutant` is a new random variation of the given `element`. Although using a normal
	distribution is more common, here a more efficient tringular distribution is used.
	*/
	mutant: function mutant(element) {
		var random = this.random,
			model = element.model,
			newValues = element.values().map(function (v, i) {
				var n = model[i].n;
				return clamp(v + (random.random() - random.random()) * n, 0, n - 1);
			});
		return new this.problem.Element(newValues);
	},

	/** `mutants` calculates an array of `count` mutants, or `this.mutantCount` by default.
	*/
	mutants: function mutants(element, count) {
		count = isNaN(count) ? this.mutantCount : +count;
		var result = [];
		for (var i = 0; i < count; ++i) {
			result.push(this.mutant(element));
		}
		return result;
	},

	/** The expansion simply returns a set of `this.mutantCount` mutants for each element in the
	current state.
	*/
	expansion: function expansion() {
		var mh = this,
			newElements = [];
		this.state.forEach(function (element) {
			newElements = newElements.concat(mh.mutants(element));
		});
		this.onExpand();
		return newElements;
	},

	// ## Utilities ################################################################################

	/** Serialization and materialization using Sermat.
	*/
	'static __SERMAT__': {
		identifier: 'DistributionEstimation',
		serializer: function serialize_DistributionEstimation(obj) {
			return [obj.__params__('mutantCount')];
		}
	}
}); // declare EvolutionStrategy.
