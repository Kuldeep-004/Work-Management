db.tasks.updateMany({verification: {: false}}, {$set: {verification: 'pending'}})
