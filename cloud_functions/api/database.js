const admin = require('firebase-admin')

const cfg = require('./config.json')

exports.convertWRtoGame = (snap, ctx) => {
  snap.ref.parent.once("value", (wrsnap, ctx) => {
    if (wrsnap.numChildren() == cfg.playersToStartRace) {
      // Create new game ref
      const raceRef = admin.database().ref('race').push()
      
      let lane = 1
      wrsnap.forEach((player) => {
        // For each player in waiting room, add player data to race then remove player from waiting room
        admin.database().ref('user/' + player.key).once('value', (userSnap) => {
          raceRef.child('player/' + player.key).set({
            name: (userSnap.val()) ? userSnap.val().profile.username : 'Guest',
            batteries: {},
            finished: false,
            currentProblem: 0,
            lane
          })
          
          userSnap.child('assignedRace').ref.set(raceRef.key)
          
          player.ref.remove()
        
          lane ++
        })
      })
      // Generate math problems
      const problems = {}
      for (i=0; i<cfg.numProblemsPerRace; i++) {
        const problem = {}
        problem.op = ['+', '-', '/', '*'][Math.floor(Math.random()*4)]
        problem.n1 = Math.floor(Math.random()*12)
        problem.n2 = Math.floor(Math.random()*12)
        if (problem.op === '/' && problem.n1 % problem.n2 !== 0) {
          // For now, only allow division if there isn't a remainder
          problem.op = '*' // do multiplication instead
        }
        problem.question = `${problem.n1} ${problem.op} ${problem.n2}`
        problem.solution = eval(problem.question)
        problems[i] = problem
      }
      // the '_race' ref is used for hidden race data
      admin.database().ref('_race/' + raceRef.key).child('problems').set(problems)
      setTimeout(() => {
        raceRef.child('player').once('value', (playersSnap) => {
          playersSnap.forEach((player) => {
            // Give player 1 battery to start with
            player.child('batteries').ref.push({ used: Date.now() })
          })
          raceRef.child('firstProblem').set(problems[0].question)
        })
      }, cfg.raceStartDelay)
    }
  })
}
