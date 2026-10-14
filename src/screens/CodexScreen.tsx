          <View style={styles.sessionRow}>
            <Text style={[styles.session, bodyFont ? { fontFamily: bodyFont, fontSize: 16 * s } : { fontSize: 16 * s }]}>
              {selected?.party.name ?? "No party"}
            </Text>
            <Pressable onPress={() => setWriting((on) => !on)} hitSlop={8}>
              <Text style={[styles.add, bodyFont ? { fontFamily: bodyFont } : null]}>{writing ? "Close" : "Add"}</Text>
            </Pressable>
          </View>