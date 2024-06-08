// this program is designed to work with dictionary files not included in the repo
// it outputs data needed for the webapp
// needed module:

// REQUIRED DATA:
// pitch accent dictionary file: https://github.com/mifunetoshiro/kanjium/blob/master/data/source_files/raw/accents.txt
// jm dict dictionary file: JMdict_e, im sure you can find it

package main

import (
    "fmt"
    "os"
    "foosoft.net/projects/jmdict"
    "bufio"
    "strings"
    "strconv"
    //"maps"
    //"errors"
)

func check(e error) {
    if e != nil {
        fmt.Println("Error: ",e)
        panic(e)
    }
}

type WordPitchData struct {
    word string

    // For if the word is in kanji, one WordPitchData is only meant to cover a single reading
    reading string

    // Pitch patterns for the reading of the word, hopefully the preferred one can be put as index 0 if there is one
    pitches []string
}

func parsePitchAccentFileLine(line string) WordPitchData {
    var parsedLine WordPitchData

    splitLine := strings.Fields(line)

    if(len(splitLine) == 2){
        parsedLine.word = splitLine[0]
        parsedLine.reading = splitLine[0]
        parsedLine.pitches = strings.Split(splitLine[1],",")
    } else if(len(splitLine) == 3){
        parsedLine.word = splitLine[0]
        parsedLine.reading = splitLine[1]
        parsedLine.pitches = strings.Split(splitLine[2],",")
    } else {
        parsedLine.word = "parsing failure"
    }
    return parsedLine
}

func main(){
    // First step: get the relevant words. this slice not to be modified after this step
    var relevantWords []string

    f, err := os.Open("serverroot/assets/srs decks/daily_deck.txt")
    check(err)

    scanner := bufio.NewScanner(f)
    for scanner.Scan() {
        chunks := strings.Split(scanner.Text(),"+")
        if(len(chunks)>1){
            relevantWords = append(relevantWords, chunks[1])
        } else {
            fmt.Println("Not enough chunks in data line: ",scanner.Text())
        }
    }
    check(scanner.Err())
    fmt.Println("Relevant Words: ",relevantWords)

    f.Close()

    // Second step: Load Jmdict
    fmt.Println("Loading Jmdict now...")
    f, err = os.Open("JMdict_e")
    check(err)

    dict, _, err := jmdict.LoadJmdict(f)
    check(err)

    fmt.Println("Jmdict finished loading. Iterating and updating data now...")
    //fmt.Println(dict.Entries[0])

    // Third step: get the relevant entries from jmdict. an int with a certain index corresponds with
    //  the same index in the relevantWords slice
    var relevantJDictEntries []int
    relevantJDictEntries = make([]int,len(relevantWords))
    for i, entry := range dict.Entries {
        for _, kanji := range entry.Kanji {
            for wordIndex, word := range relevantWords {
                if(word == kanji.Expression){
                    if(relevantJDictEntries[wordIndex] == 0){
                        relevantJDictEntries[wordIndex] = i
                        fmt.Println("Found entry! Index: ", i)
                    } else {
                        fmt.Println("Found duplicate entry and ignoring it! Index: ", i)
                    }
                    break
                }
            }
    	}
	}

    f.Close()

    // Fourth step: Load pitch accent data for relevant entries
    var relevantPitchEntries []WordPitchData
    relevantPitchEntries = make([]WordPitchData, len(relevantWords))
    fmt.Println("Loading pitch accent data now...")
    f, err = os.Open("serverroot/assets/accents.txt")
    check(err)
    fileScanner := bufio.NewScanner(f)
    fileScanner.Split(bufio.ScanLines)

    for fileScanner.Scan() {
        lineData := parsePitchAccentFileLine(fileScanner.Text())
        for wordIndex,word := range relevantWords {
            if word == lineData.word {
                if(dict.Entries[relevantJDictEntries[wordIndex]].Readings[0].Reading == lineData.reading){
                    relevantPitchEntries[wordIndex] = lineData
                }
            }
        }
    }

    f.Close()

    // Last step: write the relevant entries
    fmt.Println("Writing data...")
    f, err = os.Create("serverroot/assets/compiled_dictionary_data.txt")
    check(err)
    defer f.Close()

    w := bufio.NewWriter(f)
    for wordIndex, word := range relevantWords {
        entryIndex := relevantJDictEntries[wordIndex]
        pitchData := relevantPitchEntries[wordIndex]

        ownEntryString := word + "+"

        if(entryIndex == 0){
            ownEntryString += "no data"
        } else {
            ownEntryString += dict.Entries[entryIndex].Readings[0].Reading
            if(len(pitchData.pitches) != 0){
                ownEntryString += "("+ pitchData.pitches[0] +")"
            }
            ownEntryString += " - "
            for i, sense := range dict.Entries[entryIndex].Sense {
                ownEntryString += " " + strconv.Itoa(i+1) + ". "
                for j, definition := range sense.Glossary {
                    if(j>0){
                        ownEntryString += "; "
                    }
                    ownEntryString += definition.Content
                }
            }

        }
        _, err = w.WriteString(ownEntryString + "\n")
        check(err)
    }
    /*for _, entryIndex := range relevantJDictEntries {
        for _, sense := range dict.Entries[entryIndex].Sense {

            check(err)
            for k, definition := range sense.Glossary {
                if(k>0){
                    _, err = w.WriteString("; ")
                    check(err)
                }
                _, err = w.WriteString(definition.Content)
                check(err)
            }
            _, err := w.WriteString("\n")
            check(err)
            //fmt.Println(dict.Entries[entryIndex].Kanji[0].Expression + ":", " ", sense.Glossary[0].Content)
        }
    }*/
    //_, err = w.WriteString(pitchData + "\n")
    w.Flush()
}
